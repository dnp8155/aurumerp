import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { monthShort, sameMonth, sameDay, ymd } from "./moneyUtils";

// Loads every money-related entity once and derives all dashboard sections.
// Filters: storeId (Store id), vendorId (Vendor id), category (vendor.category string).
export function useMoneyData({ storeId, vendorId, category }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const pageOpts = (limit) => ({ sort: "-created_date", limit });
        const [salesP, expensesP, posP, bankTxnsP, txnsP, storesP, vendorsP, tallyLogsP] = await Promise.all([
          base44.entities.Sale.list(pageOpts(500)),
          base44.entities.Expense.list(pageOpts(500)),
          base44.entities.PurchaseOrder.list(pageOpts(500)),
          base44.entities.BankTransaction.list(pageOpts(500)),
          base44.entities.Transaction.list(pageOpts(500)),
          base44.entities.Store.list(pageOpts(200)),
          base44.entities.Vendor.list(pageOpts(200)),
          base44.entities.TallySyncLog.list(pageOpts(200)),
        ]);
        // list({sort,limit}) returns a page {items, next_cursor, has_more}; read .items
        const sales = salesP?.items ?? [];
        const expenses = expensesP?.items ?? [];
        const pos = posP?.items ?? [];
        const bankTxns = bankTxnsP?.items ?? [];
        const txns = txnsP?.items ?? [];
        const stores = storesP?.items ?? [];
        const vendors = vendorsP?.items ?? [];
        const tallyLogs = tallyLogsP?.items ?? [];

        const vendorMap = {};
        (vendors || []).forEach((v) => { vendorMap[v.id] = v; });

        const passStore = (rec) => !storeId || rec.store_id === storeId;
        const passVendor = (vid) => !vendorId || vid === vendorId;
        const passCategory = (vid) => !category || (vendorMap[vid]?.category || "") === category;

        // ---- Sales (money in) ----
        const fSales = (sales || []).filter(
          (s) => passStore(s) && (s.status === "completed") &&
            (!category || passCategory(s.vendor_id))
        );

        // ---- Expenses (shop costs) ----
        const fExpenses = (expenses || []).filter(
          (e) => passStore(e) && (!category || passCategory(e.vendor_id))
        );

        // ---- Purchase orders (vendor payables) ----
        const fPOs = (pos || []).filter(
          (p) => (!storeId || p.store_id === storeId) &&
            passVendor(p.vendor_id) && (!category || passCategory(p.vendor_id))
        );

        // ---- Online transactions (money in) ----
        const fTxns = (txns || []).filter(
          (t) => passStore(t) && t.status === "success" && (!category || passCategory(t.vendor_id))
        );

        // ---- Bank transactions (money in bank) ----
        // Bank balances are whole-business; do not filter by store (not on record).
        const fBank = bankTxns || [];

        // ---- Tally ----
        const fTally = tallyLogs || [];
        const stuckTally = fTally.filter((l) => l.sync_status === "pending" || l.sync_status === "failed" || l.sync_status === "retry" || l.sync_status === "blocked").length;

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        // KPI: money in this month (sales + txn inflows)
        const monthInSales = fSales.filter((s) => sameMonth(s.sale_date || s.created_date, year, month)).reduce((a, s) => a + (s.total_amount || 0), 0);
        const monthInTxn = fTxns.filter((t) => sameMonth(t.transaction_date || t.created_date, year, month)).reduce((a, t) => a + (t.amount || 0), 0);
        const monthIn = monthInSales + monthInTxn;

        // previous month same-days delta (approx: previous full month total)
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        const prevInSales = fSales.filter((s) => sameMonth(s.sale_date || s.created_date, prevYear, prevMonth)).reduce((a, s) => a + (s.total_amount || 0), 0);
        const monthInDelta = monthIn - prevInSales;

        // KPI: money in bank (latest balance per account, then sum)
        const accounts = {};
        fBank.forEach((b) => {
          const acc = b.bank_account || "Main account";
          if (!accounts[acc]) accounts[acc] = { name: acc, rows: [] };
          accounts[acc].rows.push(b);
        });
        // running balance = sum of (credit - debit) across all rows up to each date
        const accountList = Object.values(accounts).map((acc) => {
          const rows = [...acc.rows].sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));
          let bal = 0;
          const daily = {};
          rows.forEach((r) => {
            bal += r.type === "credit" ? (r.amount || 0) : -(r.amount || 0);
            daily[ymd(r.transaction_date)] = bal;
          });
          return { name: acc.name, balance: bal, daily };
        });
        const bank = accountList.reduce((a, x) => a + x.balance, 0);
        // bank day-over-day delta (latest day vs previous day with data, across all accounts)
        const allDates = [...new Set(fBank.map((b) => ymd(b.transaction_date)))].sort();
        let bankPrevDelta = 0;
        if (allDates.length >= 2) {
          const last = allDates[allDates.length - 1];
          const prev = allDates[allDates.length - 2];
          const balOn = (d) => accountList.reduce((a, acc) => a + (acc.daily[d] !== undefined ? acc.daily[d] : (acc.balance)), 0);
          // approximate: difference of net credit/debit on that day
          const dayNet = (d) => fBank.filter((b) => ymd(b.transaction_date) === d).reduce((a, b) => a + (b.type === "credit" ? b.amount : -b.amount), 0);
          bankPrevDelta = dayNet(last);
          void prev;
        }

        // KPI: owe vendors (unpaid PO payables)
        const oweVendors = fPOs.filter((p) => p.payment_status !== "paid").reduce((a, p) => a + (p.payable_amount || p.total_with_gst || p.total_amount || 0), 0);

        // KPI: GST to pay (current month): output (sales) - input (expense gst + po gst)
        const outGst = fSales.filter((s) => sameMonth(s.sale_date || s.created_date, year, month)).reduce((a, s) => a + (s.tax_amount || s.total_gst_amount || 0), 0);
        const inGstExp = fExpenses.filter((e) => sameMonth(e.expense_date || e.created_date, year, month)).reduce((a, e) => a + (e.gst_amount || 0), 0);
        const inGstPO = fPOs.filter((p) => sameMonth(p.created_date, year, month)).reduce((a, p) => a + (p.total_gst_amount || p.tax_amount || 0), 0);
        const gstPay = Math.max(0, outGst - (inGstExp + inGstPO));

        // KPI: shop expenses this month (paid expenses)
        const shopExpenses = fExpenses.filter((e) => e.status === "paid" && sameMonth(e.expense_date || e.created_date, year, month)).reduce((a, e) => a + (e.total_amount || 0), 0);

        // KPI: profit after expenses (money in - shop expenses, no COGS tracked)
        const profit = monthIn - shopExpenses;

        // Monthly flow for the year (in = sales+txn, out = expenses+po payments)
        const monthlyFlow = monthShort.map((m, i) => {
          let inflow = 0, outflow = 0;
          fSales.forEach((s) => { if (sameMonth(s.sale_date || s.created_date, year, i)) inflow += (s.total_amount || 0); });
          fTxns.forEach((t) => { if (sameMonth(t.transaction_date || t.created_date, year, i)) inflow += (t.amount || 0); });
          fExpenses.forEach((e) => { if (e.status === "paid" && sameMonth(e.expense_date || e.created_date, year, i)) outflow += (e.total_amount || 0); });
          fPOs.forEach((p) => { if (p.payment_status === "paid" && sameMonth(p.payout_date || p.created_date, year, i)) outflow += (p.payable_amount || p.total_with_gst || p.total_amount || 0); });
          return { month: m, in: inflow, out: outflow };
        });

        // Vendor payables — real amounts and due dates only. No early-pay discount
        // is invented because vendor discount terms are not stored on the record.
        const vendorPayables = fPOs
          .filter((p) => p.payment_status !== "paid" && (p.payable_amount || p.total_with_gst || p.total_amount))
          .map((p) => {
            const owe = p.payable_amount || p.total_with_gst || p.total_amount || 0;
            const due = p.payment_due_date || "";
            return {
              id: p.id, po_number: p.po_number, vendor_name: p.vendor_name, owe, dueDate: due,
              earlyDate: "", earlySave: 0,
            };
          })
          .sort((a, b) => new Date(a.dueDate || "9999") - new Date(b.dueDate || "9999"));

        // Profit per shop
        const shopProfit = (stores || [])
          .filter((s) => !storeId || s.id === storeId)
          .map((s) => {
            const moneyIn = fSales.filter((x) => x.store_id === s.id && sameMonth(x.sale_date || x.created_date, year, month)).reduce((a, x) => a + (x.total_amount || 0), 0);
            const costs = fExpenses.filter((x) => x.store_id === s.id && x.status === "paid" && sameMonth(x.expense_date || x.created_date, year, month)).reduce((a, x) => a + (x.total_amount || 0), 0);
            return { id: s.id, name: s.name, type: s.type, moneyIn, costs, profit: moneyIn - costs };
          });

        // Shop costs breakdown this month
        const costBuckets = {};
        fExpenses.filter((e) => e.status === "paid" && sameMonth(e.expense_date || e.created_date, year, month)).forEach((e) => {
          const k = e.category || "miscellaneous";
          costBuckets[k] = (costBuckets[k] || 0) + (e.total_amount || 0);
        });
        const shopCosts = Object.entries(costBuckets).map(([type, amount]) => ({ type, amount })).sort((a, b) => b.amount - a.amount);

        // GST month-by-month (last 4 months)
        const gstMonths = [];
        for (let i = 0; i < 4; i++) {
          const m = month - i; const y = m < 0 ? year - 1 : year; const mm = (m + 12) % 12;
          const collected = fSales.filter((s) => sameMonth(s.sale_date || s.created_date, y, mm)).reduce((a, s) => a + (s.tax_amount || s.total_gst_amount || 0), 0);
          const claim = fExpenses.filter((e) => sameMonth(e.expense_date || e.created_date, y, mm)).reduce((a, e) => a + (e.gst_amount || 0), 0) +
            fPOs.filter((p) => sameMonth(p.created_date, y, mm)).reduce((a, p) => a + (p.total_gst_amount || p.tax_amount || 0), 0);
          // Statutory GSTR-3B due date is the 20th of the month after the tax period.
          const dueMonth = (mm + 1) % 12;
          const dueYear = mm === 11 ? y + 1 : y;
          const dueDate = new Date(dueYear, dueMonth, 20);
          gstMonths.push({ month: monthShort[mm], collected, claim, pay: Math.max(0, collected - claim), status: `Due ${dueDate.getDate()} ${monthShort[dueMonth]}` });
        }

        // Unified payments list (newest first) with category tag for segmented filter
        const payments = [];
        fSales.forEach((s) => {
          payments.push({ id: s.id, kind: "in", cat: "sales", type: "Sales", label: s.customer_name || s.sale_number, store: s.store_name, date: s.sale_date || s.created_date, amount: s.total_amount || 0, ref: s.sale_number });
        });
        fPOs.filter((p) => p.payment_status === "paid").forEach((p) => {
          payments.push({ id: p.id, kind: "out", cat: "vendor", type: "Vendor", label: p.vendor_name, store: p.store_name, date: p.payout_date || p.created_date, amount: p.payable_amount || p.total_with_gst || p.total_amount || 0, ref: p.po_number });
        });
        fExpenses.filter((e) => e.status === "paid").forEach((e) => {
          payments.push({ id: e.id, kind: "out", cat: "shopcost", type: "Shop cost", label: e.description || e.category, store: e.store_name, date: e.expense_date || e.created_date, amount: e.total_amount || 0, ref: e.expense_number });
        });
        payments.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        // Bank balance over time (whole business) — last 30 days with data
        const bankSorted = [...fBank].sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));
        let runBal = 0;
        const bankByDate = {};
        bankSorted.forEach((b) => { runBal += b.type === "credit" ? (b.amount || 0) : -(b.amount || 0); bankByDate[ymd(b.transaction_date)] = runBal; });
        const bankDates = Object.keys(bankByDate).sort();
        const bankDaily30 = bankDates.slice(-30).map((d) => ({ date: d, balance: bankByDate[d] }));

        // Previous-year monthly flow (real, from loaded records — likely sparse)
        const monthlyFlowPrev = monthShort.map((m, i) => {
          let inflow = 0, outflow = 0;
          fSales.forEach((s) => { if (sameMonth(s.sale_date || s.created_date, year - 1, i)) inflow += (s.total_amount || 0); });
          fExpenses.forEach((e) => { if (e.status === "paid" && sameMonth(e.expense_date || e.created_date, year - 1, i)) outflow += (e.total_amount || 0); });
          fPOs.forEach((p) => { if (p.payment_status === "paid" && sameMonth(p.payout_date || p.created_date, year - 1, i)) outflow += (p.payable_amount || p.total_with_gst || p.total_amount || 0); });
          return { month: m, in: inflow, out: outflow };
        });

        // Per-shop monthly series for the line chart (profit / money in / shop costs)
        const shopColors = ["#00a878", "#e67e22", "#f1c40f", "#7f8c8d", "#3a86ff", "#7209b7", "#2a9d8f", "#e76f51"];
        const shopMonthly = (stores || [])
          .filter((s) => !storeId || s.id === storeId)
          .map((s, idx) => {
            const series = monthShort.map((m, i) => {
              const moneyIn = fSales.filter((x) => x.store_id === s.id && sameMonth(x.sale_date || x.created_date, year, i)).reduce((a, x) => a + (x.total_amount || 0), 0);
              const costs = fExpenses.filter((x) => x.store_id === s.id && x.status === "paid" && sameMonth(x.expense_date || x.created_date, year, i)).reduce((a, x) => a + (x.total_amount || 0), 0);
              return { month: m, moneyIn, costs, profit: moneyIn - costs };
            });
            return { id: s.id, name: s.name, type: s.type, color: shopColors[idx % shopColors.length], series };
          });

        // Vendor payment totals
        const paidThisYear = fPOs.filter((p) => p.payment_status === "paid" && sameMonth(p.payout_date || p.created_date, year, month));
        const vendorPaidYTD = fPOs.filter((p) => p.payment_status === "paid").reduce((a, p) => a + (p.payable_amount || p.total_with_gst || p.total_amount || 0), 0);
        const vendorPaidThisMonth = paidThisYear.reduce((a, p) => a + (p.payable_amount || p.total_with_gst || p.total_amount || 0), 0);
        // Real early-pay savings are not tracked on records, so this is 0 (not invented).
        const vendorSavedYTD = 0;

        // Pending expenses awaiting approval (real count)
        const pendingExpenses = fExpenses.filter((e) => e.status === "pending" || e.status === "approved").length;

        const categories = [...new Set((vendors || []).map((v) => v.category).filter(Boolean))].sort();

        const result = {
          stores: stores || [],
          vendors: vendors || [],
          categories,
          kpis: { bank, bankPrevDelta, monthIn, monthInDelta, oweVendors, gstPay, shopExpenses, profit, outGst, inGstExp: inGstExp + inGstPO },
          monthlyFlow,
          monthlyFlowPrev,
          accounts: accountList,
          bankDaily30,
          vendorPayables,
          vendorPaidYTD, vendorSavedYTD, vendorPaidThisMonth,
          pendingExpenses,
          shopProfit,
          shopMonthly,
          shopCosts,
          gstMonths,
          tally: { stuck: stuckTally },
          payments,
          year, month,
        };
        if (!cancelled) setData(result);
      } catch (err) {
        console.error("Money data load failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeId, vendorId, category]);

  return { data, loading };
}