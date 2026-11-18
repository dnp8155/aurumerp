import React from "react";
import { format } from "date-fns";

/**
 * Printable Tax Invoice — "Shubh Laxmi Bangles" double red-border template.
 * Matches the printed bill format: rounded double red border (#e3262e),
 * client info with black underline rules, 6-column item table, GSTIN footer.
 */
export default function TaxInvoicePrint({ sale, business }) {
  if (!sale) return null;

  const biz = business || {};
  const bizName = biz.name || "Shubh Laxmi Bangles";
  const bizTagline = biz.tagline || "Dealers in All Type of Bangles";
  const bizAddress = biz.address || "SB-21, National Plaza, R.C. Dutt Road, Alkapuri, Vadodara-7.";
  const bizPhone = biz.phone || "0265-2327577";
  const bizGstin = biz.gstin || "24AUPA3977A1ZT";
  const hsn = biz.hsn || "7117";
  const hsnLabel = biz.hsnLabel || "7117 - Imitation Jewellery";

  const RED = "#e3262e";
  const BLACK = "#000000";
  const items = sale.items || [];
  const invoiceDate = sale.sale_date ? format(new Date(sale.sale_date), "dd/MM/yyyy") : "";
  const total = sale.total_amount || 0;
  const gstRate = sale.gst_rate ?? 3;

  const redText = { color: RED };
  const blackLine = { borderBottom: `1px solid ${BLACK}` };

  return (
    <div className="print-area">
      <div style={{ border: `2px solid ${RED}`, borderRadius: "12px", padding: "6px", fontFamily: "'Helvetica Neue', Arial, sans-serif", color: "#111", maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ border: `1px solid ${RED}`, borderRadius: "8px", padding: "20px 26px" }}>
          {/* Header bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", ...redText, fontSize: "12px", borderBottom: `1px solid ${RED}`, paddingBottom: "6px" }}>
            <span>Ph.: {bizPhone}</span>
            <span style={{ fontWeight: 700, letterSpacing: "1px", fontSize: "14px", textDecoration: "underline" }}>TAX INVOICE</span>
            <span style={{ textAlign: "right", lineHeight: 1.4 }}>
              Original - White<br />Duplicate - Yellow
            </span>
          </div>

          {/* Store name */}
          <div style={{ textAlign: "center", padding: "8px 0 6px" }}>
            <h1 style={{ ...redText, fontSize: "26px", fontWeight: 800, letterSpacing: "0.5px", margin: 0 }}>{bizName}</h1>
            <p style={{ ...redText, fontSize: "13px", margin: "2px 0" }}>{bizTagline}</p>
            <p style={{ ...redText, fontSize: "12px", margin: "2px 0" }}>{bizAddress}</p>
          </div>

          {/* Client info — black underline rules */}
          <div style={{ borderTop: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "10px 4px", fontSize: "13px", ...redText, display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: "10px", columnGap: "24px" }}>
            <div><span>Invoice No. : </span><span style={{ ...blackLine, display: "inline-block", minWidth: "120px" }}>&nbsp;{sale.sale_number}</span></div>
            <div><span>Date : </span><span style={{ ...blackLine, display: "inline-block", minWidth: "120px" }}>&nbsp;{invoiceDate}</span></div>
            <div style={{ gridColumn: "1 / -1" }}><span>Buyer's Name : </span><span style={{ ...blackLine, display: "inline-block", minWidth: "300px" }}>&nbsp;{sale.customer_name || ""}</span></div>
            <div style={{ gridColumn: "1 / -1" }}><span>Address : </span><span style={{ ...blackLine, display: "inline-block", minWidth: "300px" }}>&nbsp;{sale.customer_address || ""}</span></div>
            <div style={{ gridColumn: "1 / -1" }}><span>Buyer's GSTIN : </span><span style={{ ...blackLine, display: "inline-block", minWidth: "260px" }}>&nbsp;{sale.customer_gstin || ""}</span></div>
          </div>

          {/* Items table */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", marginTop: "4px" }}>
            <thead>
              <tr style={{ ...redText }}>
                {["Sr. No.", "HSN Code", "Particulars", "Qty.", "Rate", "Amount"].map((h, i) => (
                  <th key={h} style={{
                    padding: "8px 6px",
                    borderTop: `1px solid ${RED}`,
                    borderBottom: `1px solid ${RED}`,
                    borderLeft: i === 0 ? "none" : `1px solid ${RED}`,
                    borderRight: i === 5 ? "none" : `1px solid ${RED}`,
                    textAlign: i >= 3 ? "center" : "left",
                    fontWeight: 700,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} style={{ height: "30px" }}>
                  <td style={{ borderLeft: `1px solid ${RED}`, borderRight: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "4px 8px" }}>{idx + 1}</td>
                  <td style={{ borderLeft: `1px solid ${RED}`, borderRight: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "4px 8px" }}>{hsn}</td>
                  <td style={{ borderLeft: `1px solid ${RED}`, borderRight: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "4px 8px" }}>{item.product_name}</td>
                  <td style={{ borderLeft: `1px solid ${RED}`, borderRight: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "4px 8px", textAlign: "center" }}>{item.quantity}</td>
                  <td style={{ borderLeft: `1px solid ${RED}`, borderRight: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "4px 8px", textAlign: "center" }}>{(item.unit_price || 0).toFixed(2)}</td>
                  <td style={{ borderLeft: `1px solid ${RED}`, borderRight: `1px solid ${RED}`, borderBottom: `1px solid ${RED}`, padding: "4px 8px", textAlign: "center" }}>{(item.total_price || 0).toFixed(2)}</td>
                </tr>
              ))}
              {/* Filler rows to fill the table height like the printed bill */}
              {Array.from({ length: Math.max(0, 9 - items.length) }).map((_, i) => (
                <tr key={`fill-${i}`} style={{ height: "30px" }}>
                  {Array.from({ length: 6 }).map((__, c) => (
                    <td key={c} style={{ borderLeft: c === 0 ? "none" : `1px solid ${RED}`, borderRight: c === 5 ? "none" : `1px solid ${RED}`, borderBottom: `1px solid ${RED}` }}>&nbsp;</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer info */}
          <div style={{ ...redText, fontSize: "12px", padding: "8px 4px 4px" }}>
            <p style={{ margin: "2px 0" }}>Inclusive of {gstRate}% GST</p>
            <p style={{ margin: "2px 0" }}>{hsnLabel}</p>
            <p style={{ margin: "2px 0" }}>GSTIN : {bizGstin}</p>
          </div>

          {/* Total row */}
          <div style={{ display: "flex", justifyContent: "flex-end", borderTop: `1px solid ${RED}`, padding: "10px 4px", fontSize: "14px", ...redText }}>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontWeight: 700 }}>TOTAL</span>
              <span style={{ marginLeft: "16px", fontWeight: 700, borderBottom: `1px solid ${RED}`, display: "inline-block", minWidth: "140px" }}>₹ {total.toFixed(2)}</span>
            </div>
          </div>

          {/* Terms + signature */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: `1px solid ${RED}`, padding: "12px 4px", fontSize: "12px", ...redText }}>
            <div>
              <p style={{ fontWeight: 700, margin: "0 0 4px" }}>Terms :</p>
              <p style={{ margin: "2px 0" }}>• Subject to Vadodara Jurisdiction</p>
              <p style={{ margin: "2px 0" }}>• Goods once sold will not taken back</p>
              <p style={{ margin: "2px 0" }}>• Sunday Closed</p>
            </div>
            <div style={{ textAlign: "center", minWidth: "220px" }}>
              <p style={{ margin: "0 0 18px" }}>Certified that above information are true &amp; Correct</p>
              <div style={{ borderBottom: `1px solid ${RED}`, width: "180px", margin: "0 auto 4px" }} />
              <p style={{ fontWeight: 700, margin: 0 }}>Authorised Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}