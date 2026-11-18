import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { FileText, Plus, Check, X, Eye, Trash2, Printer, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/erp/StatusBadge";
import PageHeader from "@/components/erp/PageHeader";
import EmptyState from "@/components/erp/EmptyState";
import POPrintLabels from "@/components/erp/POPrintLabels";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";
import { formatGstType, formatPricingType } from "@/lib/gstUtils";

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const [pos, setPOs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewPO, setViewPO] = useState(null);
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [poData, vendorData] = await Promise.all([
        base44.entities.PurchaseOrder.list("-created_date", 100),
        base44.entities.Vendor.list("-created_date", 200),
      ]);
      setPOs(poData || []);
      setVendors(vendorData || []);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  const sendPOViaWhatsApp = (po) => {
    const vendor = vendors.find((v) => v.id === po.vendor_id);
    const phone = (vendor?.phone || "").replace(/\D/g, "");
    if (!phone) { toast({ title: "No vendor phone", description: "Add a phone number to this vendor to send via WhatsApp", variant: "destructive" }); return; }
    const lines = (po.items || []).map((it, i) => `${i + 1}. ${it.product_name || "—"} — Qty: ${it.quantity} — Buy: ₹${(it.final_price || it.unit_price || 0).toLocaleString()}`);
    const gst = po.gst_type === "inter" ? `IGST: ₹${(po.igst_amount || 0).toLocaleString()}` : `CGST: ₹${(po.cgst_amount || 0).toLocaleString()}\nSGST: ₹${(po.sgst_amount || 0).toLocaleString()}`;
    const msg = `*Purchase Order: ${po.po_number}*\n\nVendor: ${po.vendor_name || "—"}\nLocation: ${po.store_name || "—"}\n\n*Items:*\n${lines.join("\n")}\n\nSubtotal: ₹${(po.subtotal_before_gst || 0).toLocaleString()}\n${gst}\n*Total: ₹${(po.total_with_gst || po.total_amount || 0).toLocaleString()}*\n\nStatus: ${po.status}${po.notes ? `\n\nNotes: ${po.notes}` : ""}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleApprove = async (po) => {
    try { await base44.entities.PurchaseOrder.update(po.id, { status: "approved", approved_by: "Admin", approved_date: new Date().toISOString() }); toast({ title: "PO approved" }); loadData(); }
    catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const handleReject = async (po) => {
    try { await base44.entities.PurchaseOrder.update(po.id, { status: "rejected" }); toast({ title: "PO rejected" }); loadData(); }
    catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this PO?")) return;
    try { await base44.entities.PurchaseOrder.delete(id); toast({ title: "PO deleted" }); loadData(); }
    catch (err) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title={t("po.title")} description={t("po.desc")}>
        <Button onClick={() => navigate("/purchase-orders/new")}>
          <Plus className="mr-2 h-4 w-4" /> New PO Request
        </Button>
      </PageHeader>

      {loading ? (
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      ) : pos.length === 0 ? (
        <EmptyState icon={FileText} title={t("po.no_orders")} description={t("po.desc")} />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead><TableHead>Vendor</TableHead><TableHead>Location</TableHead>
                <TableHead>Amount</TableHead><TableHead className="text-right">GST</TableHead><TableHead>Payment</TableHead><TableHead>Status</TableHead><TableHead>Tally</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pos.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-mono text-xs font-medium">{po.po_number}</TableCell>
                  <TableCell className="font-medium">{po.vendor_name || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{po.store_name || "—"}</TableCell>
                  <TableCell className="text-sm font-medium">₹{(po.total_with_gst || po.total_amount || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">₹{(po.total_gst_amount || 0).toLocaleString()}</TableCell>
                  <TableCell><StatusBadge status={po.payment_status} /></TableCell>
                  <TableCell><StatusBadge status={po.status} /></TableCell>
                  <TableCell>{po.tally_synced ? (<span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3 w-3" /> Synced</span>) : <span className="text-xs text-muted-foreground">Pending</span>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewPO(po)}><Eye className="h-4 w-4" /></Button>
                      {po.status === "pending_approval" && (<><Button variant="ghost" size="icon" onClick={() => handleApprove(po)} className="text-emerald-600"><Check className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleReject(po)} className="text-red-600"><X className="h-4 w-4" /></Button></>)}
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(po.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!viewPO} onOpenChange={(open) => !open && setViewPO(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>PO Details — {viewPO?.po_number}</DialogTitle></DialogHeader>
          {viewPO && (
            <div className="space-y-4 print-area">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Vendor:</span> <span className="font-medium">{viewPO.vendor_name}</span></div>
                <div><span className="text-muted-foreground">Location:</span> <span className="font-medium">{viewPO.store_name}</span></div>
                <div><span className="text-muted-foreground">Vendor GST:</span> <span className="font-mono text-xs">{viewPO.vendor_gst_number || "—"}</span></div>
                <div><span className="text-muted-foreground">Company GST:</span> <span className="font-mono text-xs">{viewPO.company_gst_number || "—"}</span></div>
                <div><span className="text-muted-foreground">GST Type:</span> <span className="font-medium">{formatGstType(viewPO.gst_type)}</span></div>
                <div><span className="text-muted-foreground">Vendor GST Mode:</span> <span className="font-medium">{formatPricingType(viewPO.vendor_gst_pricing_type)}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewPO.status} /></div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Items</p>
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Buy Price</TableHead><TableHead className="text-right">Buy (Calc)</TableHead>
                        <TableHead className="text-right">Sell Price</TableHead><TableHead>GST Mode</TableHead><TableHead>Mode</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(viewPO.items || []).map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{item.product_name || "—"}</TableCell>
                          <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                          <TableCell className="text-right text-sm">₹{(item.unit_price || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm font-medium">₹{(item.final_price || item.unit_price || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm font-medium text-emerald-600">₹{(item.selling_price || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <span className={`text-xs ${(item.gst_pricing_type || "exclusive") === "inclusive" ? "text-violet-600" : "text-blue-600"}`}>
                              {(item.gst_pricing_type || "exclusive") === "inclusive" ? "Inclusive" : "Exclusive"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.pricing_mode === "manual_override" ? (
                              <span className="text-xs text-amber-600" title={item.override_reason}>Manual Override</span>
                            ) : <span className="text-xs text-primary">Automatic</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal (before GST):</span><span className="font-medium">₹{((viewPO.subtotal_before_gst || viewPO.subtotal || 0)).toLocaleString()}</span></div>
                {viewPO.gst_type === "inter" ? (
                  <div className="flex justify-between"><span className="text-muted-foreground">IGST:</span><span className="font-medium">₹{(viewPO.igst_amount || 0).toLocaleString()}</span></div>
                ) : (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">CGST:</span><span className="font-medium">₹{(viewPO.cgst_amount || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">SGST:</span><span className="font-medium">₹{(viewPO.sgst_amount || 0).toLocaleString()}</span></div>
                  </>
                )}
                <div className="flex justify-between pt-2 border-t"><span className="font-semibold">Total (with GST):</span><span className="font-bold text-primary">₹{((viewPO.total_with_gst || viewPO.total_amount || 0)).toLocaleString()}</span></div>
              </div>
              {viewPO.notes && <div className="text-sm"><span className="text-muted-foreground">Notes:</span> {viewPO.notes}</div>}
              <POPrintLabels poNumber={viewPO.po_number} vendorCode={viewPO.vendor_code} />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t no-print">
            <Button type="button" variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print PO</Button>
            <Button type="button" onClick={() => sendPOViaWhatsApp(viewPO)}><Send className="mr-2 h-4 w-4" /> Send via WhatsApp</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}