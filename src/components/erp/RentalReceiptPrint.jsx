import React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

/**
 * A4 portrait rental receipt — clean, professional layout.
 * Shows all rental data: customer, items, charges, payment, terms.
 */
export default function RentalReceiptPrint({ rental, store }) {
  if (!rental) return null;

  const s = store || {};
  const items = (rental.items || []);
  const pieces = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  const rentTotal = rental.total_rental_charge || 0;
  const deposit = rental.security_deposit || 0;
  const lateFee = rental.late_fee || 0;
  const damageCharge = rental.damage_charge || 0;
  const total = rental.total_payable || (rentTotal + deposit + lateFee + damageCharge);
  const refund = rental.status === "returned"
    ? Math.max(0, deposit - damageCharge - lateFee)
    : null;

  const startDate = rental.rental_start_date ? format(new Date(rental.rental_start_date), "dd MMM yyyy") : "—";
  const endDate = rental.rental_end_date ? format(new Date(rental.rental_end_date), "dd MMM yyyy") : "—";
  const returnDate = rental.actual_return_date ? format(new Date(rental.actual_return_date), "dd MMM yyyy") : "—";
  const duration = rental.rental_duration || (rental.rental_start_date && rental.rental_end_date
    ? Math.ceil((new Date(rental.rental_end_date) - new Date(rental.rental_start_date)) / (1000 * 60 * 60 * 24))
    : 0);

  const shopName = s.name || "";
  const tagline = s.invoice_tagline || "";
  const address = [s.address, s.city, s.state, s.pincode].filter(Boolean).join(", ");
  const phone = s.phone || "";
  const gstin = s.gst_number || "";

  const payMethodLabel = (m) => {
    const labels = { cash: "Cash", upi: "UPI", card: "Card", net_banking: "Net Banking", cheque: "Cheque", wallet: "Wallet" };
    return labels[m] || m || "—";
  };

  const BORDER = "2px solid #b91c1c";
  const BORDER_LIGHT = "1px solid #b91c1c";

  return (
    <div className="space-y-3">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          body { background: #fff !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex justify-end gap-2 no-print">
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print / Save PDF</Button>
      </div>

      <div className="print-area" style={{ border: BORDER, padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "ui-sans-serif, system-ui, sans-serif", background: "#fff" }}>
        {/* Header */}
        <div style={{ textAlign: "center", paddingBottom: "10px", borderBottom: BORDER_LIGHT }}>
          <p style={{ fontSize: "24px", fontWeight: 800, color: "#b91c1c", margin: 0, letterSpacing: "1px" }}>{(shopName || "SUBHLAKSHMI").toUpperCase()}</p>
          {tagline && <p style={{ fontSize: "12px", color: "#b91c1c", margin: "3px 0", fontStyle: "italic" }}>{tagline}</p>}
          {address && <p style={{ fontSize: "11px", color: "#555", margin: "2px 0" }}>{address}</p>}
          {phone && <p style={{ fontSize: "11px", color: "#555", margin: "2px 0" }}>Phone: {phone}</p>}
          {gstin && <p style={{ fontSize: "11px", color: "#555", margin: "2px 0 0" }}>GSTIN: {gstin}</p>}
          <p style={{ fontSize: "15px", fontWeight: 700, color: "#b91c1c", marginTop: "8px", marginBottom: 0, borderTop: BORDER_LIGHT, paddingTop: "6px" }}>RENTAL RECEIPT</p>
        </div>

        {/* Receipt Info */}
        <div style={{ padding: "10px 0", borderBottom: BORDER_LIGHT, fontSize: "12px", lineHeight: 1.8 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>Rental #:</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{rental.rental_number}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>Date:</span>
            <span>{rental.rental_start_date ? format(new Date(rental.rental_start_date), "dd MMM yyyy") : format(new Date(), "dd MMM yyyy")}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>Status:</span>
            <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{rental.status || "active"}</span>
          </div>
        </div>

        {/* Customer Details */}
        <div style={{ padding: "10px 0", borderBottom: BORDER_LIGHT, fontSize: "12px", lineHeight: 1.8 }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", margin: "0 0 4px", textTransform: "uppercase" }}>Customer Details</p>
          <div><span style={{ color: "#666" }}>Name: </span><span style={{ fontWeight: 600 }}>{rental.customer_name}</span></div>
          {rental.customer_phone && <div><span style={{ color: "#666" }}>Phone: </span>{rental.customer_phone}</div>}
          {rental.customer_email && <div><span style={{ color: "#666" }}>Email: </span>{rental.customer_email}</div>}
          {rental.customer_address && <div><span style={{ color: "#666" }}>Address: </span>{rental.customer_address}</div>}
        </div>

        {/* Rental Period */}
        <div style={{ padding: "10px 0", borderBottom: BORDER_LIGHT, fontSize: "12px", lineHeight: 1.8 }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", margin: "0 0 4px", textTransform: "uppercase" }}>Rental Period</p>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>Start Date:</span><span>{startDate}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>End Date:</span><span>{endDate}</span>
          </div>
          {rental.status === "returned" && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#666" }}>Actual Return:</span><span style={{ fontWeight: 600 }}>{returnDate}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>Duration:</span><span>{duration} day(s)</span>
          </div>
        </div>

        {/* Items Table */}
        {items.length > 0 && (
          <div style={{ padding: "10px 0", borderBottom: BORDER_LIGHT }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", margin: "0 0 6px", textTransform: "uppercase" }}>Rental Items ({pieces} piece(s))</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
              <thead>
                <tr style={{ borderBottom: BORDER_LIGHT }}>
                  <th style={{ textAlign: "left", padding: "4px 6px", color: "#666", fontWeight: 600 }}>#</th>
                  <th style={{ textAlign: "left", padding: "4px 6px", color: "#666", fontWeight: 600 }}>Product</th>
                  <th style={{ textAlign: "center", padding: "4px 6px", color: "#666", fontWeight: 600 }}>Qty</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: "#666", fontWeight: 600 }}>Rate</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", color: "#666", fontWeight: 600 }}>Charge</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "4px 6px" }}>{i + 1}</td>
                    <td style={{ padding: "4px 6px", fontWeight: 500 }}>{it.product_name || "—"}</td>
                    <td style={{ padding: "4px 6px", textAlign: "center" }}>{it.quantity || 0}</td>
                    <td style={{ padding: "4px 6px", textAlign: "right" }}>
                      {it.rental_rate ? `₹${Number(it.rental_rate).toLocaleString()}` : "—"}
                      {it.rate_unit && <span style={{ fontSize: "9px", color: "#999" }}> /{it.rate_unit.replace("per_", "").replace("_", " ")}</span>}
                    </td>
                    <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 600 }}>
                      {it.rental_charge ? `₹${Number(it.rental_charge).toLocaleString()}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Charges */}
        <div style={{ padding: "12px 0", borderBottom: BORDER_LIGHT, fontSize: "13px", lineHeight: 2 }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", margin: "0 0 6px", textTransform: "uppercase" }}>Charges</p>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>Rental Charge:</span><span>₹{rentTotal.toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>Security Deposit:</span><span>₹{deposit.toLocaleString()}</span>
          </div>
          {lateFee > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#666" }}>Late Fee:</span><span style={{ color: "#dc2626" }}>₹{lateFee.toLocaleString()}</span>
            </div>
          )}
          {damageCharge > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#666" }}>Damage Charge:</span><span style={{ color: "#dc2626" }}>₹{damageCharge.toLocaleString()}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: BORDER_LIGHT, paddingTop: "6px", marginTop: "4px", fontSize: "14px" }}>
            <span>Total Payable:</span><span style={{ color: "#b91c1c" }}>₹{total.toLocaleString()}</span>
          </div>
          {rental.payment_method && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#666" }}>Payment Mode:</span>
              <span style={{ textTransform: "capitalize" }}>{payMethodLabel(rental.payment_method)}</span>
            </div>
          )}
          {rental.payment_method === "cheque" && rental.payment_cheque_name && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#666" }}>Cheque Name:</span><span>{rental.payment_cheque_name}</span>
            </div>
          )}
          {rental.payment_method === "cheque" && rental.payment_cheque_number && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#666" }}>Cheque No:</span><span style={{ fontFamily: "monospace" }}>{rental.payment_cheque_number}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666" }}>Payment Status:</span>
            <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{rental.payment_status || "pending"}</span>
          </div>
          {refund !== null && (
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#16a34a" }}>
              <span>Deposit Refund:</span><span>₹{refund.toLocaleString()}</span>
            </div>
          )}
          {rental.refund_method && refund !== null && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#666" }}>Refund Mode:</span>
              <span style={{ textTransform: "capitalize" }}>{payMethodLabel(rental.refund_method)}</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {rental.notes && (
          <div style={{ padding: "8px 0", borderBottom: BORDER_LIGHT, fontSize: "11px" }}>
            <span style={{ color: "#666" }}>Notes: </span>{rental.notes}
          </div>
        )}

        {/* Terms */}
        <div style={{ borderTop: BORDER_LIGHT, paddingTop: "8px", fontSize: "10px", color: "#666", lineHeight: 1.5 }}>
          <p style={{ fontWeight: 600, margin: "0 0 2px" }}>Terms &amp; Conditions:</p>
          <p style={{ margin: 0 }}>1) Goods must be returned by the due date, otherwise late fee applies per day.</p>
          <p style={{ margin: 0 }}>2) Any damage to the goods will be charged to the customer.</p>
          <p style={{ margin: 0 }}>3) Booking once confirmed cannot be cancelled.</p>
          <p style={{ margin: 0 }}>4) Rental charge is non-refundable once the rental period starts.</p>
          <p style={{ margin: 0 }}>5) Security deposit refunded after deducting damages and late fees.</p>
        </div>

        {/* Signatures */}
        <div style={{ borderTop: BORDER_LIGHT, paddingTop: "12px", marginTop: "8px", display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
          <div>
            <p style={{ color: "#666", margin: 0 }}>Customer Signature</p>
            <div style={{ width: "140px", borderTop: "1px solid #999", marginTop: "32px" }}></div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ color: "#666", margin: 0 }}>Authorized Signatory</p>
            <div style={{ width: "140px", borderTop: "1px solid #999", marginTop: "32px", marginLeft: "auto" }}></div>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: "11px", color: "#b91c1c", marginTop: "12px", marginBottom: 0, fontWeight: 600 }}>
          Thank you for choosing {shopName || "Subhlakshmi"}!
        </p>
      </div>
    </div>
  );
}