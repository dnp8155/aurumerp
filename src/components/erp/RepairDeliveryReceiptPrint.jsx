import React from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Printer, MessageCircle } from "lucide-react";

const BORDER = "2px solid #b91c1c";
const BORDER_LIGHT = "1px solid #b91c1c";

export default function RepairDeliveryReceiptPrint({ repair, store, onWhatsApp }) {
  if (!repair) return null;
  const s = store || {};
  const totalCharge = (repair.total_charge || (repair.labor_charge || 0) + (repair.parts_cost || 0));
  const advance = repair.advance_paid || 0;
  const balance = repair.balance_due || Math.max(0, totalCharge - advance);
  const refundDue = repair.payment_status === "refunded" ? Math.max(0, advance - totalCharge) : 0;

  const techStr = repair.technicians?.length > 0
    ? repair.technicians.map(t => `${t.name}${t.phone ? " (" + t.phone + ")" : ""}`).join(", ")
    : `${repair.technician_name || "—"}${repair.technician_phone ? " (" + repair.technician_phone + ")" : ""}`;

  const sendWhatsApp = () => {
    if (!repair.customer_phone) return;
    const msg = `*REPAIR DELIVERY RECEIPT*\nJob #: ${repair.repair_number}\n\nCustomer: ${repair.customer_name}\nProduct: ${repair.product_name}\n\nStore: ${repair.store_name || "—"}\nTechnician: ${techStr}\n\nDelivered: ${repair.delivered_date ? format(new Date(repair.delivered_date), "dd MMM yyyy") : "—"}\n\nLabor: ₹${(repair.labor_charge || 0).toLocaleString()}\nParts: ₹${(repair.parts_cost || 0).toLocaleString()}\nTotal Charge: ₹${totalCharge.toLocaleString()}\nAdvance Paid: ₹${advance.toLocaleString()}\nBalance Paid: ₹${balance.toLocaleString()}\n\nThank you for choosing ${s.name || "Subhlakshmi"}!`;
    const phone = repair.customer_phone.replace(/[^0-9]/g, "");
    const wa = phone.length === 10 ? "91" + phone : phone;
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="space-y-3">
      <div className="print-area" style={{ border: BORDER, padding: "16px", maxWidth: "480px", margin: "0 auto", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", paddingBottom: "8px", borderBottom: BORDER_LIGHT }}>
          <p style={{ fontSize: "20px", fontWeight: 800, color: "#b91c1c", margin: 0 }}>{(s.name || "SUBHLAKSHMI").toUpperCase()}</p>
          {s.address && <p style={{ fontSize: "11px", color: "#555", margin: "2px 0" }}>{s.address}</p>}
          {s.phone && <p style={{ fontSize: "11px", color: "#555", margin: 0 }}>Phone: {s.phone}</p>}
          {s.gst_number && <p style={{ fontSize: "11px", color: "#555", margin: "2px 0 0" }}>GSTIN: {s.gst_number}</p>}
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#b91c1c", marginTop: "6px", marginBottom: 0 }}>REPAIR DELIVERY RECEIPT</p>
        </div>

        <div style={{ padding: "10px 0", borderBottom: BORDER_LIGHT, fontSize: "12px", lineHeight: 1.7 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#666" }}>Job #:</span><span style={{ fontFamily: "monospace", fontWeight: 600 }}>{repair.repair_number}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#666" }}>Date:</span><span>{repair.delivered_date ? format(new Date(repair.delivered_date), "dd MMM yyyy") : format(new Date(), "dd MMM yyyy")}</span></div>
        </div>

        <div style={{ padding: "10px 0", borderBottom: BORDER_LIGHT, fontSize: "12px", lineHeight: 1.7 }}>
          <div><span style={{ color: "#666" }}>Customer: </span><span style={{ fontWeight: 600 }}>{repair.customer_name}</span></div>
          {repair.customer_phone && <div><span style={{ color: "#666" }}>Phone: </span>{repair.customer_phone}</div>}
          {repair.customer_email && <div><span style={{ color: "#666" }}>Email: </span>{repair.customer_email}</div>}
          <div style={{ marginTop: "4px" }}><span style={{ color: "#666" }}>Product: </span><span style={{ fontWeight: 600 }}>{repair.product_name}</span></div>
          {repair.product_sku && <div><span style={{ color: "#666" }}>SKU: </span><span style={{ fontFamily: "monospace" }}>{repair.product_sku}</span></div>}
          <div><span style={{ color: "#666" }}>Technician: </span>{techStr}</div>
        </div>

        {repair.issue_description && (
          <div style={{ padding: "8px 0", borderBottom: BORDER_LIGHT, fontSize: "11px" }}>
            <span style={{ color: "#666" }}>Issue: </span>{repair.issue_description}
          </div>
        )}
        {repair.repair_actions?.length > 0 && (
          <div style={{ padding: "8px 0", borderBottom: BORDER_LIGHT, fontSize: "11px" }}>
            <p style={{ fontWeight: 700, color: "#b91c1c", margin: "0 0 4px", textTransform: "uppercase", fontSize: "10px" }}>Parts & Labor Used</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
              <thead>
                <tr style={{ borderBottom: BORDER_LIGHT }}>
                  <th style={{ textAlign: "left", padding: "2px 4px", color: "#666" }}>Description</th>
                  <th style={{ textAlign: "center", padding: "2px 4px", color: "#666" }}>Type</th>
                  <th style={{ textAlign: "center", padding: "2px 4px", color: "#666" }}>Qty</th>
                  <th style={{ textAlign: "right", padding: "2px 4px", color: "#666" }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {repair.repair_actions.map((a, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "2px 4px" }}>{a.description || "—"}</td>
                    <td style={{ padding: "2px 4px", textAlign: "center", textTransform: "capitalize" }}>{a.type || "—"}</td>
                    <td style={{ padding: "2px 4px", textAlign: "center" }}>{a.quantity || 1}</td>
                    <td style={{ padding: "2px 4px", textAlign: "right" }}>₹{(a.total_cost || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {repair.technician_notes && (
          <div style={{ padding: "8px 0", borderBottom: BORDER_LIGHT, fontSize: "11px" }}>
            <span style={{ color: "#666" }}>Work Done: </span>{repair.technician_notes}
          </div>
        )}

        <div style={{ padding: "10px 0", fontSize: "12px", lineHeight: 1.8 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#666" }}>Labor Charge:</span><span>₹{(repair.labor_charge || 0).toLocaleString()}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#666" }}>Parts Cost:</span><span>₹{(repair.parts_cost || 0).toLocaleString()}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: BORDER_LIGHT, paddingTop: "4px", marginTop: "4px" }}><span>Total Charge:</span><span>₹{totalCharge.toLocaleString()}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#666" }}>Advance Paid:</span><span style={{ color: "#16a34a" }}>₹{advance.toLocaleString()}</span></div>
          {refundDue > 0 ? (
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#16a34a" }}><span>Refund Due:</span><span>₹{refundDue.toLocaleString()}</span></div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#b91c1c" }}><span>Balance Paid:</span><span>₹{balance.toLocaleString()}</span></div>
          )}
          {repair.refund_method && refundDue > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#666" }}>Refund Method:</span><span style={{ textTransform: "capitalize" }}>{repair.refund_method.replace(/_/g, " ")}</span></div>
          )}
        </div>

        <div style={{ borderTop: BORDER_LIGHT, paddingTop: "10px", display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
          <div>
            <p style={{ color: "#666", margin: 0 }}>Customer Signature</p>
            <div style={{ width: "120px", borderTop: "1px solid #999", marginTop: "28px" }}></div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ color: "#666", margin: 0 }}>Authorized Signatory</p>
            <div style={{ width: "120px", borderTop: "1px solid #999", marginTop: "28px", marginLeft: "auto" }}></div>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: "10px", color: "#b91c1c", marginTop: "10px", marginBottom: 0 }}>
          Thank you for choosing {s.name || "Subhlakshmi"}!
        </p>
      </div>

      <div className="flex gap-2 no-print" style={{ maxWidth: "480px", margin: "0 auto" }}>
        <Button variant="outline" className="flex-1" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
        <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={onWhatsApp || sendWhatsApp}><MessageCircle className="mr-2 h-4 w-4" /> WhatsApp</Button>
      </div>
    </div>
  );
}