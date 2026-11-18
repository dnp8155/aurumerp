import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Receipt, TrendingUp, TrendingDown, Wallet, FileText, Download, RefreshCw, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatCard from "@/components/erp/StatCard";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

export default function GST() {
  const [loading, setLoading] = useState(true);
  const [pos, setPOs] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [gstRegistrations, setGstRegistrations] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [poData, saleData, expData, gstData] = await Promise.all([
        base44.entities.PurchaseOrder.list('-created_date', 500),
        base44.entities.Sale.list('-created_date', 500),
        base44.entities.Expense.list('-created_date', 200),
        base44.entities.GstRegistration.list('-created_date', 50),
      ]);
      setPOs(poData || []);
      setSales(saleData || []);
      setExpenses(expData || []);
      setGstRegistrations(gstData || []);
    } catch (err) {
      console.error("Failed to load GST data", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter by date range
  const filterByDate = (records, dateField = "created_date") => {
    if (!dateFrom && !dateTo) return records;
    return records.filter(r => {
      const d = r[dateField] ? new Date(r[dateField]) : null;
      if (!d) return false;
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  };

  const filteredPOs = filterByDate(pos.filter(p => p.status === "approved" || p.status === "received" || p.status === "partially_received"));
  const filteredSales = filterByDate(sales.filter(s => s.status === "completed"));
  const filteredExpenses = filterByDate(expenses.filter(e => e.status === "paid"));

  // Calculate GST amounts
  const outputGST = filteredSales.reduce((sum, s) => sum + (s.total_gst_amount || s.tax_amount || 0), 0);
  const inputGSTPO = filteredPOs.reduce((sum, p) => sum + (p.total_gst_amount || 0), 0);
  const inputGSTExp = filteredExpenses.reduce((sum, e) => sum + (e.gst_amount || 0), 0);
  const totalInputGST = inputGSTPO + inputGSTExp;
  const netGST = outputGST - totalInputGST;

  // CGST/SGST/IGST breakdown
  const outputCGST = filteredSales.reduce((sum, s) => sum + (s.cgst_amount || 0), 0);
  const outputSGST = filteredSales.reduce((sum, s) => sum + (s.sgst_amount || 0), 0);
  const outputIGST = filteredSales.reduce((sum, s) => sum + (s.igst_amount || 0), 0);
  const inputCGST = filteredPOs.reduce((sum, p) => sum + (p.cgst_amount || 0), 0);
  const inputSGST = filteredPOs.reduce((sum, p) => sum + (p.sgst_amount || 0), 0);
  const inputIGST = filteredPOs.reduce((sum, p) => sum + (p.igst_amount || 0), 0);

  const exportCSV = (data, filename) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(","), ...data.map(row => headers.map(h => `"${row[h] ?? ""}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-6"><div className="h-96 rounded-xl bg-muted animate-pulse" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title="GST Management" description="GST calculation, reporting, and return filing (GSTR-1 & GSTR-3B)">
        <Button variant="outline" onClick={loadData}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </PageHeader>

      {/* Date filter */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <Label className="text-xs">From Date</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-44" />
        </div>
        <div>
          <Label className="text-xs">To Date</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-44" />
        </div>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>Clear</Button>
        )}
        <div className="ml-auto text-sm text-muted-foreground">
          {filteredPOs.length + filteredSales.length} transactions in range
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard"><Wallet className="mr-2 h-4 w-4" /> Dashboard</TabsTrigger>
          <TabsTrigger value="gstr1"><FileText className="mr-2 h-4 w-4" /> GSTR-1 (Sales)</TabsTrigger>
          <TabsTrigger value="gstr3b"><Receipt className="mr-2 h-4 w-4" /> GSTR-3B (Summary)</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Output GST (Sales)" value={`₹${Math.round(outputGST).toLocaleString()}`} icon={TrendingUp} accent="emerald" />
            <StatCard label="Input GST (Purchases)" value={`₹${Math.round(totalInputGST).toLocaleString()}`} icon={TrendingDown} accent="amber" />
            <StatCard label="Net GST Payable" value={`₹${Math.round(netGST).toLocaleString()}`} icon={Wallet} accent={netGST >= 0 ? "red" : "emerald"} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Output GST breakdown */}
            <div className="rounded-xl border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-600" /> Output GST (Sales)</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between pb-2 border-b">
                  <span className="text-muted-foreground">CGST</span>
                  <span className="font-medium">₹{Math.round(outputCGST).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pb-2 border-b">
                  <span className="text-muted-foreground">SGST</span>
                  <span className="font-medium">₹{Math.round(outputSGST).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pb-2 border-b">
                  <span className="text-muted-foreground">IGST</span>
                  <span className="font-medium">₹{Math.round(outputIGST).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="font-semibold">Total Output GST</span>
                  <span className="font-bold text-emerald-600">₹{Math.round(outputGST).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Input GST breakdown */}
            <div className="rounded-xl border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingDown className="h-4 w-4 text-amber-600" /> Input Tax Credit (Purchases)</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between pb-2 border-b">
                  <span className="text-muted-foreground">CGST (POs)</span>
                  <span className="font-medium">₹{Math.round(inputCGST).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pb-2 border-b">
                  <span className="text-muted-foreground">SGST (POs)</span>
                  <span className="font-medium">₹{Math.round(inputSGST).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pb-2 border-b">
                  <span className="text-muted-foreground">IGST (POs)</span>
                  <span className="font-medium">₹{Math.round(inputIGST).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pb-2 border-b">
                  <span className="text-muted-foreground">Input GST (Expenses)</span>
                  <span className="font-medium">₹{Math.round(inputGSTExp).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="font-semibold">Total Input Tax Credit</span>
                  <span className="font-bold text-amber-600">₹{Math.round(totalInputGST).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net GST payable summary */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3">GST Liability Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between pb-2 border-b">
                <span className="text-muted-foreground">Total Output GST (Collected from Sales)</span>
                <span className="font-bold text-emerald-600">₹{Math.round(outputGST).toLocaleString()}</span>
              </div>
              <div className="flex justify-between pb-2 border-b">
                <span className="text-muted-foreground">Less: Input Tax Credit (from Purchases & Expenses)</span>
                <span className="font-bold text-amber-600">- ₹{Math.round(totalInputGST).toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="font-semibold text-base">Net GST Payable</span>
                <span className={`text-xl font-heading font-bold ${netGST >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                  ₹{Math.round(netGST).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                {netGST >= 0
                  ? "You owe this amount to the government (Output GST > Input Tax Credit)"
                  : "You have excess Input Tax Credit (refundable or carry-forward)"}
              </p>
            </div>
          </div>
        </TabsContent>

        {/* GSTR-1 Tab (Sales) */}
        <TabsContent value="gstr1" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">GSTR-1 — Outward Supplies (Sales)</h3>
              <p className="text-xs text-muted-foreground">Details of all sales invoices with GST breakdown</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => exportCSV(filteredSales.map(s => ({
              Invoice: s.sale_number, Date: s.sale_date ? format(new Date(s.sale_date), "dd-MM-yyyy") : "",
              Customer: s.customer_name || "Walk-in", Store: s.store_name || "",
              TaxableValue: s.subtotal_before_gst || s.subtotal || 0,
              CGST: s.cgst_amount || 0, SGST: s.sgst_amount || 0, IGST: s.igst_amount || 0,
              TotalGST: s.total_gst_amount || s.tax_amount || 0, InvoiceValue: s.total_amount || 0,
            })), "GSTR-1.csv")}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
          {filteredSales.length === 0 ? (
            <EmptyState icon={FileText} title="No sales in this period" description="Sales invoices will appear here for GSTR-1 filing" />
          ) : (
            <div className="rounded-xl border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Taxable Value</TableHead>
                    <TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead>
                    <TableHead className="text-right">IGST</TableHead>
                    <TableHead className="text-right">Total GST</TableHead>
                    <TableHead className="text-right">Invoice Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs font-medium">{s.sale_number}</TableCell>
                      <TableCell className="text-xs">{s.sale_date ? format(new Date(s.sale_date), "dd MMM yyyy") : "—"}</TableCell>
                      <TableCell className="text-sm">{s.customer_name || "Walk-in"}</TableCell>
                      <TableCell className="text-right text-sm">₹{((s.subtotal_before_gst || s.subtotal || 0) - (s.discount_amount || 0)).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">₹{(s.cgst_amount || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">₹{(s.sgst_amount || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">₹{(s.igst_amount || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm font-medium text-emerald-600">₹{(s.total_gst_amount || s.tax_amount || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm font-bold">₹{(s.total_amount || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell className="text-right">₹{Math.round(filteredSales.reduce((s, x) => s + (x.subtotal_before_gst || x.subtotal || 0) - (x.discount_amount || 0), 0)).toLocaleString()}</TableCell>
                    <TableCell className="text-right">₹{Math.round(outputCGST).toLocaleString()}</TableCell>
                    <TableCell className="text-right">₹{Math.round(outputSGST).toLocaleString()}</TableCell>
                    <TableCell className="text-right">₹{Math.round(outputIGST).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-emerald-600">₹{Math.round(outputGST).toLocaleString()}</TableCell>
                    <TableCell className="text-right">₹{Math.round(filteredSales.reduce((s, x) => s + (x.total_amount || 0), 0)).toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* GSTR-3B Tab (Summary) */}
        <TabsContent value="gstr3b" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">GSTR-3B — Monthly Summary Return</h3>
              <p className="text-xs text-muted-foreground">Consolidated GST summary for filing</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => exportCSV([
              { Section: "3.1(a) Outward taxable supplies (Sales)", TaxableValue: Math.round(filteredSales.reduce((s, x) => s + (x.subtotal_before_gst || x.subtotal || 0) - (x.discount_amount || 0), 0)), CGST: Math.round(outputCGST), SGST: Math.round(outputSGST), IGST: Math.round(outputIGST), TotalTax: Math.round(outputGST) },
              { Section: "4. Inward supplies (Purchases - ITC)", TaxableValue: Math.round(filteredPOs.reduce((s, x) => s + (x.subtotal_before_gst || x.subtotal || 0), 0)), CGST: Math.round(inputCGST), SGST: Math.round(inputSGST), IGST: Math.round(inputIGST), TotalTax: Math.round(inputGSTPO) },
              { Section: "5. Input GST from Expenses", TaxableValue: 0, CGST: 0, SGST: 0, IGST: 0, TotalTax: Math.round(inputGSTExp) },
              { Section: "6. Net GST Payable", TaxableValue: 0, CGST: Math.round(outputCGST - inputCGST), SGST: Math.round(outputSGST - inputSGST), IGST: Math.round(outputIGST - inputIGST), TotalTax: Math.round(netGST) },
            ], "GSTR-3B.csv")}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>

          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/2">Description</TableHead>
                  <TableHead className="text-right">Taxable Value</TableHead>
                  <TableHead className="text-right">CGST</TableHead>
                  <TableHead className="text-right">SGST</TableHead>
                  <TableHead className="text-right">IGST</TableHead>
                  <TableHead className="text-right">Total Tax</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-sm font-medium">3.1(a) Outward taxable supplies (Sales)</TableCell>
                  <TableCell className="text-right text-sm">₹{Math.round(filteredSales.reduce((s, x) => s + (x.subtotal_before_gst || x.subtotal || 0) - (x.discount_amount || 0), 0)).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm">₹{Math.round(outputCGST).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm">₹{Math.round(outputSGST).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm">₹{Math.round(outputIGST).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm font-medium text-emerald-600">₹{Math.round(outputGST).toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm font-medium">4. Inward supplies (Purchases — ITC)</TableCell>
                  <TableCell className="text-right text-sm">₹{Math.round(filteredPOs.reduce((s, x) => s + (x.subtotal_before_gst || x.subtotal || 0), 0)).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm">₹{Math.round(inputCGST).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm">₹{Math.round(inputSGST).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm">₹{Math.round(inputIGST).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm font-medium text-amber-600">₹{Math.round(inputGSTPO).toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm font-medium">5. Input GST from Expenses (ITC)</TableCell>
                  <TableCell className="text-right text-sm">—</TableCell>
                  <TableCell className="text-right text-sm">—</TableCell>
                  <TableCell className="text-right text-sm">—</TableCell>
                  <TableCell className="text-right text-sm">—</TableCell>
                  <TableCell className="text-right text-sm font-medium text-amber-600">₹{Math.round(inputGSTExp).toLocaleString()}</TableCell>
                </TableRow>
                <TableRow className="font-bold bg-muted/50 border-t-2">
                  <TableCell>6. Net GST Payable / (Refundable)</TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right">₹{Math.round(outputCGST - inputCGST).toLocaleString()}</TableCell>
                  <TableCell className="text-right">₹{Math.round(outputSGST - inputSGST).toLocaleString()}</TableCell>
                  <TableCell className="text-right">₹{Math.round(outputIGST - inputIGST).toLocaleString()}</TableCell>
                  <TableCell className={`text-right ${netGST >= 0 ? "text-red-600" : "text-emerald-600"}`}>₹{Math.round(netGST).toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* GST Registrations */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Building2 className="h-4 w-4" /> Company GST Registrations</h3>
            {gstRegistrations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No GST registrations configured. Add them in Settings.</p>
            ) : (
              <div className="space-y-2">
                {gstRegistrations.map(g => (
                  <div key={g.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{g.registration_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{g.gst_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{g.city}, {g.state}</p>
                      {g.is_default && <span className="text-xs text-primary font-medium">Default</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}