import React from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Printer, MessageCircle } from "lucide-react";

const BORDER = "2px solid #b91c1c";
const BORDER_LIGHT = "1px solid #b91c1c";

export default function RepairJobReceiptPrint({ repair, store, onWhatsApp }) {
  if (!repair) return null;
  const s = store || {};
  const est = repair.estimated_cost || 0;
  const advance = repair.advance_paid || 0;
  const balance = repair.balance_due || Math.max(0, est - advance);

  const techStr = repair.technicians?.length > 0
    ? repair.technicians.map(t => `${t.name}${t.phone ? " (" + t.phone + ")" : ""}`).join(", ")
    : `${repair.technician_name || "—"}${repair.technician_phone ? " (" + repair.technician_phone + ")" : ""}`;

  const sendWhatsApp = () => {
    if (!repair.customer_phone) return;
    const msg = `*REPAIR JOB RECEIPT*\nJob #: ${repair.repair_number}\n\nCustomer: ${repair.customer_name}\nProduct: ${repair.product_name}\nIssue: ${repair.issue_description || "—"}\n\nStore: ${repair.store_name || "—"}\nTechnician: ${techStr}\n\nReceived: ${repair.received_date ? format(new Date(repair.received_date), "dd MMM yyyy") : "—"}\nEst. Completion: ${repair.estimated_completion ? format(new Date(repair.estimated_completion), "dd MMM yyyy") : "—"}\n\nEstimated Cost: ₹${est.toLocaleString()}\nAdvance Paid: ₹${advance.toLocaleString()}\nBalance Due: ₹${balance.toLocaleString()}\n\nThank you for choosing ${s.name || "Subhlakshmi"}!`;
    const phone = repair.customer_phone.replace(/[^0-9]/g, "");
    const wa = phone.length === 10 ? "91" + phone : phone;
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="space-y-3">
      <div className="print-area" style={{ border: BORDER, padding: "20px", maxWidth: "520px", margin: "0 auto", fontFamily: "ui-sans-serif, system-ui, sans-serif", background: "#fff" }}>
        {/* Header */}
        <div style={{ textAlign: "center", paddingBottom: "10px", borderBottom: BORDER_LIGHT }}>
          <p style={{ fontSize: "22px", fontWeight: 800, color: "#b91c1c", margin: 0, letterSpacing: "1px" }}>{(s.name || "SUBHLAKSHMI").toUpperCase()}</p>
          {s.invoice_tagline && <p style={{ fontSize: "11px", color: "#b91c1c", margin: "2px 0", fontStyle: "italic" }}>{s.invoice_tagline}</p>}
          {s.address && <p style={{ fontSize: "11px", color: "#555", margin: "2px 0" }}>{s.address}</p>}
          <p style={{ fontSize: "11px", color: "#555", margin: "2px 0" }}>{[s.city, s.state, s.pincode].filter(Boolean).join(", ")}</p>
          {s.phone && <p style={{ fontSize: "11px", color: "#555", margin: "2px 0" }}>Phone: {s.phone}</p>}
          {s.gst_number && <p style={{ fontSize: "11px", color: "#555", margin: "2px 0 0" }}>GSTIN: {s.gst_number}</p>}
          <p style={{ fontSize: "14px", fontWeight: 700, color: "#b91c1c", marginTop: "8px", marginBottom: 0, borderTop: BORDER_LIGHT, paddingTop: "6px" }}>REPAIR JOB RECEIPT</p>
        </div>

        {/* Job Info */}
        <div style={{ padding: "10px 0", borderBottom: BORDER_LIGHT, fontSize: "12px", lineHeight: 1.8 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#666" }}>Job #:</span><span style={{ fontFamily: "monospace", fontWeight: 700 }}>{repair.repair_number}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#666" }}>Date:</span><span>{repair.received_date ? format(new Date(repair.received_date), "dd MMM yyyy") : format(new Date(), "dd MMM yyyy")}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#666" }}>Priority:</span><span style={{ textTransform: "capitalize", fontWeight: 600 }}>{repair.priority || "medium"}</span></div>
        </div>

        {/* Customer Details */}
        <div style={{ padding: "10px 0", borderBottom: BORDER_LIGHT, fontSize: "12px", lineHeight: 1.8 }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", margin: "0 0 4px", textTransform: "uppercase" }}>Customer Details</p>
          <div><span style={{ color: "#666" }}>Name: </span><span style={{ fontWeight: 600 }}>{repair.customer_name}</span></div>
          {repair.customer_phone && <div><span style={{ color: "#666" }}>Phone: </span>{repair.customer_phone}</div>}
          {repair.customer_email && <div><span style={{ color: "#666" }}>Email: </span>{repair.customer_email}</div>}
          {repair.customer_address && <div><span style={{ color: "#666" }}>Address: </span>{repair.customer_address}</div>}
        </div>

        {/* Product Details */}
        <div style={{ padding: "10px 0", borderBottom: BORDER_LIGHT, fontSize: "12px", lineHeight: 1.8 }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", margin: "0 0 4px", textTransform: "uppercase" }}>Product Details</p>
          <div><span style={{ color: "#666" }}>Product: </span><span style={{ fontWeight: 600 }}>{repair.product_name}</span></div>
          {repair.product_sku && <div><span style={{ color: "#666" }}>SKU: </span><span style={{ fontFamily: "monospace" }}>{repair.product_sku}</span></div>}
          {repair.product_barcode && <div><span style={{ color: "#666" }}>Barcode: </span><span style={{ fontFamily: "monospace" }}>{repair.product_barcode}</span></div>}
          {repair.product_image && (
            <div style={{ textAlign: "center", marginTop: "6px" }}>
              <img src={repair.product_image} alt="Product" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "4px", border: "1px solid #ddd" }} />
            </div>
          )}
        </div>

        {/* Issue */}
        <div style={{ padding: "10px 0", borderBottom: BORDER_LIGHT, fontSize: "12px", lineHeight: 1.6 }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", margin: "0 0 4px", textTransform: "uppercase" }}>Issue Description</p>
          <p style={{ margin: 0 }}>{repair.issue_description || "—"}</p>
        </div>

        {repair.customer_notes && (
          <div style={{ padding: "10px 0", borderBottom: BORDER_LIGHT, fontSize: "12px", lineHeight: 1.6 }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", margin: "0 0 4px", textTransform: "uppercase" }}>Customer Notes</p>
            <p style={{ margin: 0 }}>{repair.customer_notes}</p>
          </div>
        )}

        {/* Service Details */}
        <div style={{ padding: "10px 0", borderBottom: BORDER_LIGHT, fontSize: "12px", lineHeight: 1.8 }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", margin: "0 0 4px", textTransform: "uppercase" }}>Service Details</p>
          <div><span style={{ color: "#666" }}>Store: </span>{repair.store_name || "—"}</div>
          <div><span style={{ color: "#666" }}>Technician: </span>{techStr}</div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#666" }}>Received:</span><span>{repair.received_date ? format(new Date(repair.received_date), "dd MMM yyyy") : "—"}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#666" }}>Est. Completion:</span><span>{repair.estimated_completion ? format(new Date(repair.estimated_completion), "dd MMM yyyy") : "—"}</span></div>
          {repair.warranty_claim && (
            <div style={{ marginTop: "4px" }}><span style={{ color: "#666" }}>Warranty: </span><span style={{ color: "#16a34a", fontWeight: 600 }}>Yes{repair.warranty_reference ? ` (${repair.warranty_reference})` : ""}</span></div>
          )}
        </div>

        {/* Charges */}
        <div style={{ padding: "12px 0", fontSize: "13px", lineHeight: 2 }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", margin: "0 0 6px", textTransform: "uppercase" }}>Charges</p>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#666" }}>Estimated Cost:</span><span>₹{est.toLocaleString()}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#666" }}>Advance Paid:</span><span style={{ color: "#16a34a", fontWeight: 600 }}>₹{advance.toLocaleString()}</span></div>
          {repair.payment_method && advance > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#666" }}>Payment Mode:</span><span style={{ textTransform: "capitalize" }}>{repair.payment_method.replace(/_/g, " ")}</span></div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: BORDER_LIGHT, paddingTop: "6px", marginTop: "4px", fontSize: "14px" }}>
            <span>Balance Due:</span><span style={{ color: "#b91c1c" }}>₹{balance.toLocaleString()}</span>
          </div>
        </div>

        {/* Terms */}
        <div style={{ borderTop: BORDER_LIGHT, paddingTop: "8px", fontSize: "10px", color: "#666", lineHeight: 1.5 }}>
          <p style={{ fontWeight: 600, margin: "0 0 2px" }}>Terms:</p>
          <p style={{ margin: 0 }}>• Please carry this receipt at the time of delivery.</p>
          <p style={{ margin: 0 }}>• Repair charges may vary after diagnosis. Advance is adjustable in final bill.</p>
          <p style={{ margin: 0 }}>• Warranty claims require original invoice reference.</p>
        </div>

        {/* Signatures */}
        <div style={{ borderTop: BORDER_LIGHT, paddingTop: "12px", marginTop: "8px", display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
          <div>
            <p style={{ color: "#666", margin: 0 }}>Customer Signature</p>
            <div style={{ width: "130px", borderTop: "1px solid #999", marginTop: "32px" }}></div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ color: "#666", margin: 0 }}>Authorized Signatory</p>
            <div style={{ width: "130px", borderTop: "1px solid #999", marginTop: "32px", marginLeft: "auto" }}></div>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: "11px", color: "#b91c1c", marginTop: "12px", marginBottom: 0, fontWeight: 600 }}>
          Thank you for choosing {s.name || "Subhlakshmi"}!
        </p>
      </div>

      <div className="flex gap-2 no-print" style={{ maxWidth: "520px", margin: "0 auto" }}>
        <Button variant="outline" className="flex-1" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
        <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={onWhatsApp || sendWhatsApp}><MessageCircle className="mr-2 h-4 w-4" /> WhatsApp</Button>
      </div>
    </div>
  );
}