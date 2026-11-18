import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/erp/PageHeader';
import EmptyState from '@/components/erp/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Wallet, Send, FlaskConical, AlertTriangle, CheckCircle2, Clock, Building2 } from 'lucide-react';

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function VendorPayouts() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(null); // po_id currently paying
  const [duePOs, setDuePOs] = useState([]);
  const [paidPOs, setPaidPOs] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      // Due: unpaid/partial, received or approved, due date <= today (or no due date)
      const dueRes = await base44.entities.PurchaseOrder.filter(
        { payment_status: { $in: ['unpaid', 'partial'] }, status: { $in: ['received', 'approved', 'partially_received'] } },
        { sort: 'payment_due_date', limit: 100 }
      );
      const due = (dueRes.items || []).filter((po) => {
        const payable = po.payable_amount || po.total_with_gst || po.total_amount || 0;
        return payable > 0;
      });
      setDuePOs(due);

      const paidRes = await base44.entities.PurchaseOrder.filter(
        { payment_status: 'paid', payout_id: { $exists: true } },
        { sort: '-payout_date', limit: 20 }
      );
      setPaidPOs(paidRes.items || []);
    } catch (e) {
      toast({ title: 'Failed to load payouts', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const runPayout = async (po, dryRun = false) => {
    setPaying(po.id);
    try {
      const res = await base44.functions.invoke('vendorPayout', {
        po_id: po.id,
        mode: po.payout_mode || 'IMPS',
        dry_run: dryRun
      });
      const data = res.data;
      if (dryRun) {
        toast({
          title: 'Dry-run successful',
          description: `${data.vendor_name} — ${fmtINR(data.payable_amount)} via ${data.mode}. Bank details OK.`
        });
      } else {
        toast({
          title: 'Payout initiated',
          description: `${data.vendor_name} — ${fmtINR(data.amount)} via ${data.mode}. RazorpayX ID: ${data.payout_id}`
        });
        await loadData();
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      toast({ title: 'Payout failed', description: msg, variant: 'destructive' });
    } finally {
      setPaying(null);
    }
  };

  // Queue a payout through the corporate bank API via the bank-bridge-agent
  // (ICICI CIB / HDFC / Kotak) instead of RazorpayX. dry_run validates only.
  const queueBankPayout = async (po, dryRun = false) => {
    setPaying(po.id);
    try {
      const res = await base44.functions.invoke('bankPayout', {
        po_id: po.id,
        mode: po.payout_mode || 'IMPS',
        bank_provider: po.bank_provider || 'ICICI',
        dry_run: dryRun
      });
      const data = res.data;
      if (dryRun) {
        toast({
          title: 'Bank dry-run OK',
          description: `${data.vendor_name} — ${fmtINR(data.payable_amount)} via ${data.mode} (${data.bank_provider}). Beneficiary details valid.`
        });
      } else {
        toast({
          title: 'Payment queued for bank',
          description: `${data.vendor_name} — ${fmtINR(data.amount)} via ${data.mode}. The bank-bridge-agent will deliver it.`
        });
        await loadData();
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      toast({ title: 'Bank payout failed', description: msg, variant: 'destructive' });
    } finally {
      setPaying(null);
    }
  };

  const isOverdue = (po) => {
    if (!po.payment_due_date) return false;
    return new Date(po.payment_due_date) < new Date(new Date().toDateString());
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <PageHeader
        title="Vendor Payouts"
        description="Automated NEFT/IMPS/UPI payouts to vendors via RazorpayX. Pay due POs manually or enable auto-pay."
      >
        <Button variant="outline" onClick={loadData} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </PageHeader>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Due for Payment</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{duePOs.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {fmtINR(duePOs.reduce((s, p) => s + (p.payable_amount || p.total_with_gst || p.total_amount || 0), 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{duePOs.filter(isOverdue).length}</div>
            <div className="text-xs text-muted-foreground mt-1">Past due date</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paid (RazorpayX)</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidPOs.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Recent payouts</div>
          </CardContent>
        </Card>
      </div>

      {/* Due table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Due Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading…</div>
          ) : duePOs.length === 0 ? (
            <EmptyState title="No due payments" description="All vendor POs are paid or have no payable amount." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Payable</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duePOs.map((po) => {
                    const payable = po.payable_amount || po.total_with_gst || po.total_amount || 0;
                    const overdue = isOverdue(po);
                    return (
                      <TableRow key={po.id}>
                        <TableCell className="font-medium">{po.po_number}</TableCell>
                        <TableCell>{po.vendor_name}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtINR(payable)}</TableCell>
                        <TableCell>
                          <span className={overdue ? 'text-red-600 font-medium' : ''}>
                            {fmtDate(po.payment_due_date)}
                          </span>
                          {overdue && <Badge variant="destructive" className="ml-2">Overdue</Badge>}
                        </TableCell>
                        <TableCell>{po.payout_mode || 'IMPS'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => runPayout(po, true)}
                              disabled={paying === po.id}
                            >
                              <FlaskConical className="h-3.5 w-3.5" />
                              Test
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => queueBankPayout(po, false)}
                              disabled={paying === po.id}
                              title="Queue through corporate bank API (ICICI/HDFC) via the bank-bridge-agent"
                            >
                              <Building2 className="h-3.5 w-3.5" />
                              Bank Pay
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => runPayout(po, false)}
                              disabled={paying === po.id}
                            >
                              <Send className="h-3.5 w-3.5" />
                              {paying === po.id ? 'Paying…' : 'RazorpayX'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent payouts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /> Recent Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          {paidPOs.length === 0 ? (
            <EmptyState title="No payouts yet" description="Paid POs via RazorpayX will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>RazorpayX ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paidPOs.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">{po.po_number}</TableCell>
                      <TableCell>{po.vendor_name}</TableCell>
                      <TableCell className="text-right">{fmtINR(po.payable_amount || po.total_with_gst || po.total_amount)}</TableCell>
                      <TableCell>{po.payout_mode}</TableCell>
                      <TableCell className="font-mono text-xs">{po.payout_id}</TableCell>
                      <TableCell><Badge variant="secondary">{po.payout_status || 'paid'}</Badge></TableCell>
                      <TableCell>{fmtDate(po.payout_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}