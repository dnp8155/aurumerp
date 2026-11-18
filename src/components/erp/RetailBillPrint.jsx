import React from "react";
import { format } from "date-fns";

/**
 * Printable Retail Bill (B2C) — for POS walk-in consumer sales.
 * NOT a Tax Invoice: no HSN column, no buyer GSTIN, no GST breakdown,
 * no "Original/Duplicate" markers. A simple retail cash memo.
 * Keeps the same double red-border house style as the Tax Invoice.
 */
export default function RetailBillPrint({ sale, business }) {
  if (!sale) return null;

  const biz = business || {};
  const bizName = biz.name || "Shubh Laxmi Bangles";
  const bizTagline = biz.tagline || "Dealers in All Type of Bangles";
  const bizAddress = biz.address || "SB-21, National Plaza, R.C. Dutt Road, Alkapuri, Vadodara-7.";
  const bizPhone = biz.phone || "0265-2327577";

  const RED = "#e3262e";
  const BLACK = "#000000";
  const items = sale.items || [];
  const billDate = sale.sale_date ? format(new Date(sale.sale_date), "dd/MM/yyyy") : "";
  const total = sale.total_amount || 0;
  const discount = sale.discount_amount || 0;
  const subtotal = sale.subtotal || 0;

  const redText = { color: RED };
  const blackLine = { borderBottom: `1px solid ${BLACK}` };

  return (
    <div className="print-area">
      <div style={{ border: `2px solid ${RED}`, borderRadius: "12px", padding: "6px", fontFamily: "'Helvetica Neue', Arial, sans-serif", color: "#111", maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ border: `1px solid ${RED}`, borderRadius: "8px", padding: "20px 26px" }}>
          {/* Header bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", ...redText, fontSize: "12px", borderBottom: `1px solid ${RED}`, paddingBottom: "6px" }}>
            <span>Ph.: {bizPhone}</span>
            <span style={{ fontWeight: 700, letterSpacing: "1px", fontSize: "14px", textDecoration: "underline" }}>RETAIL INVOICE</span>
            <span style={{ textAlign: "right", lineHeight: 1.4 }}>
              Bill No. {sale.sale_number}
            </span>
          </div>

          {/* Store name */}
          <div style={{ textAlign: "center", padding: "8px 0 6px" }}>
            <h1 style={{ ...redText, fontSize: "26px", fontWeight: 800, letterSpacing: "0.5px", margin: 0 }}>{bizName}</h1>
            <p style={{ ...redText, fontSize: "13px", margin: "2px 0" }}>{bizTagline}</p>
            <p style={{ ...redText, fontSize: "12px", margin: "2px 0" }}>{bizAddress}</p>
          </div>

          {/* Customer info — black underline rules (no GSTIN) */}
          <div style={{ borderTop: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "10px 4px", fontSize: "13px", ...redText, display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: "10px", columnGap: "24px" }}>
            <div><span>Date : </span><span style={{ ...blackLine, display: "inline-block", minWidth: "120px" }}>&nbsp;{billDate}</span></div>
            <div><span>Customer : </span><span style={{ ...blackLine, display: "inline-block", minWidth: "120px" }}>&nbsp;{sale.customer_name || "Walk-in Customer"}</span></div>
            {sale.customer_phone && (
              <div style={{ gridColumn: "1 / -1" }}><span>Phone : </span><span style={{ ...blackLine, display: "inline-block", minWidth: "260px" }}>&nbsp;{sale.customer_phone}</span></div>
            )}
            {sale.customer_address && (
              <div style={{ gridColumn: "1 / -1" }}><span>Address : </span><span style={{ ...blackLine, display: "inline-block", minWidth: "300px" }}>&nbsp;{sale.customer_address}</span></div>
            )}
          </div>

          {/* Items table — 5 columns (no HSN) */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", marginTop: "4px" }}>
            <thead>
              <tr style={{ ...redText }}>
                {["Sr. No.", "Particulars", "Qty.", "Rate", "Amount"].map((h, i) => (
                  <th key={h} style={{
                    padding: "8px 6px",
                    borderTop: `1px solid ${RED}`,
                    borderBottom: `1px solid ${RED}`,
                    borderLeft: i === 0 ? "none" : `1px solid ${RED}`,
                    borderRight: i === 4 ? "none" : `1px solid ${RED}`,
                    textAlign: i >= 2 ? "center" : "left",
                    fontWeight: 700,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} style={{ height: "30px" }}>
                  <td style={{ borderLeft: `1px solid ${RED}`, borderRight: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "4px 8px" }}>{idx + 1}</td>
                  <td style={{ borderLeft: `1px solid ${RED}`, borderRight: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "4px 8px" }}>{item.product_name}</td>
                  <td style={{ borderLeft: `1px solid ${RED}`, borderRight: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "4px 8px", textAlign: "center" }}>{item.quantity}</td>
                  <td style={{ borderLeft: `1px solid ${RED}`, borderRight: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "4px 8px", textAlign: "center" }}>{(item.unit_price || 0).toFixed(2)}</td>
                  <td style={{ borderLeft: `1px solid ${RED}`, borderRight: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "4px 8px", textAlign: "center" }}>{(item.total_price || 0).toFixed(2)}</td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 9 - items.length) }).map((_, i) => (
                <tr key={`fill-${i}`} style={{ height: "30px" }}>
                  {Array.from({ length: 5 }).map((__, c) => (
                    <td key={c} style={{ borderLeft: c === 0 ? "none" : `1px solid ${RED}`, borderRight: c === 4 ? "none" : `1px solid ${RED}`, borderBottom: `1px solid ${RED}` }}>&nbsp;</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ ...redText, fontSize: "12px", padding: "8px 4px 4px" }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{ textAlign: "right", minWidth: "240px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                  <span>Subtotal</span><span>₹ {subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                    <span>Discount</span><span>- ₹ {discount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${RED}`, marginTop: "4px", paddingTop: "4px", fontWeight: 700, fontSize: "14px" }}>
                  <span>TOTAL</span><span>₹ {total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment + terms */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: `1px solid ${RED}`, padding: "12px 4px", fontSize: "12px", ...redText }}>
            <div>
              <p style={{ margin: "2px 0" }}>Payment: <strong style={{ textTransform: "capitalize" }}>{(sale.payment_method || "cash").replace(/_/g, " ")}</strong></p>
              <p style={{ fontWeight: 700, margin: "6px 0 4px" }}>Terms :</p>
              <p style={{ margin: "2px 0" }}>• Subject to Vadodara Jurisdiction</p>
              <p style={{ margin: "2px 0" }}>• Goods once sold will not taken back</p>
              <p style={{ margin: "2px 0" }}>• Sunday Closed</p>
            </div>
            <div style={{ textAlign: "center", minWidth: "220px" }}>
              <p style={{ margin: "0 0 18px" }}>This is a computer generated bill</p>
              <div style={{ borderBottom: `1px solid ${RED}`, width: "180px", margin: "0 auto 4px" }} />
              <p style={{ fontWeight: 700, margin: 0 }}>Authorised Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}