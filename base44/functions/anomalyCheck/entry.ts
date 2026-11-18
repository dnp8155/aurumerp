import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const alertsCreated = [];

    // 1. Negative inventory check
    const inventory = await base44.entities.Inventory.list('-created_date', 500);
    const negativeStock = (inventory || []).filter(i => (i.quantity || 0) < 0);
    for (const inv of negativeStock) {
      const existing = await base44.entities.Alert.filter({
        type: 'negative_inventory',
        entity_id: inv.id,
        status: 'new'
      });
      if (!existing || existing.length === 0) {
        await base44.entities.Alert.create({
          type: 'negative_inventory',
          severity: 'critical',
          title: `Negative Stock: ${inv.product_name || inv.sku || 'Unknown'}`,
          message: `Inventory at ${inv.store_name || 'Unknown store'} has negative quantity (${inv.quantity}). Product: ${inv.sku || ''}`,
          entity_type: 'Inventory',
          entity_id: inv.id,
          entity_number: inv.sku || '',
          status: 'new'
        });
        alertsCreated.push('negative_inventory');
      }
    }

    // 2. Stuck shipments (>7 days in transit)
    const shipments = await base44.entities.Shipment.list('-created_date', 200);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const stuckShipments = (shipments || []).filter(s =>
      (s.status === 'dispatched' || s.status === 'in_transit') &&
      s.dispatched_date && new Date(s.dispatched_date) < sevenDaysAgo
    );
    for (const ship of stuckShipments) {
      const existing = await base44.entities.Alert.filter({
        type: 'stuck_shipment',
        entity_id: ship.id,
        status: 'new'
      });
      if (!existing || existing.length === 0) {
        await base44.entities.Alert.create({
          type: 'stuck_shipment',
          severity: 'high',
          title: `Stuck Shipment: ${ship.shipment_number}`,
          message: `Shipment ${ship.shipment_number} (${ship.from_store_name} → ${ship.to_store_name}) has been in transit for more than 7 days since ${ship.dispatched_date?.split('T')[0]}`,
          entity_type: 'Shipment',
          entity_id: ship.id,
          entity_number: ship.shipment_number || '',
          status: 'new'
        });
        alertsCreated.push('stuck_shipment');
      }
    }

    // 3. Expense spike (current month > 2x previous month average)
    const expenses = await base44.entities.Expense.list('-created_date', 500);
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
    const thisMonthExpenses = (expenses || []).filter(e => e.expense_date && e.expense_date.slice(0, 7) === thisMonth);
    const lastMonthExpenses = (expenses || []).filter(e => e.expense_date && e.expense_date.slice(0, 7) === lastMonth);
    const thisMonthTotal = thisMonthExpenses.reduce((s, e) => s + (e.total_amount || 0), 0);
    const lastMonthTotal = lastMonthExpenses.reduce((s, e) => s + (e.total_amount || 0), 0);
    if (lastMonthTotal > 0 && thisMonthTotal > 2 * lastMonthTotal) {
      const existing = await base44.entities.Alert.filter({
        type: 'expense_spike',
        status: 'new'
      });
      if (!existing || existing.length === 0) {
        await base44.entities.Alert.create({
          type: 'expense_spike',
          severity: 'medium',
          title: `Expense Spike Detected — ${thisMonth}`,
          message: `This month's expenses (₹${Math.round(thisMonthTotal).toLocaleString()}) are ${Math.round(thisMonthTotal / lastMonthTotal)}x last month (₹${Math.round(lastMonthTotal).toLocaleString()}). Review expense categories.`,
          entity_type: 'Expense',
          status: 'new'
        });
        alertsCreated.push('expense_spike');
      }
    }

    // 4. Duplicate vendor payment (same vendor, same amount, same day)
    const paidExpenses = (expenses || []).filter(e => e.status === 'paid' && e.vendor_id);
    const seenPayments = {};
    for (const exp of paidExpenses) {
      const key = `${exp.vendor_id}-${exp.total_amount}-${exp.expense_date}`;
      if (seenPayments[key]) {
        const existing = await base44.entities.Alert.filter({
          type: 'duplicate_payment',
          entity_id: exp.id,
          status: 'new'
        });
        if (!existing || existing.length === 0) {
          await base44.entities.Alert.create({
            type: 'duplicate_payment',
            severity: 'high',
            title: `Possible Duplicate Payment — ${exp.expense_number}`,
            message: `Expense ${exp.expense_number} (₹${exp.total_amount}) to ${exp.vendor_name} on ${exp.expense_date} matches another payment. Verify.`,
            entity_type: 'Expense',
            entity_id: exp.id,
            entity_number: exp.expense_number || '',
            status: 'new'
          });
          alertsCreated.push('duplicate_payment');
        }
      } else {
        seenPayments[key] = true;
      }
    }

    // 5. Low stock alerts (below min_stock_level)
    const lowStock = (inventory || []).filter(i =>
      i.min_stock_level > 0 && (i.quantity || 0) <= i.min_stock_level && (i.quantity || 0) > 0
    );
    for (const inv of lowStock.slice(0, 10)) {
      const existing = await base44.entities.Alert.filter({
        type: 'low_stock',
        entity_id: inv.id,
        status: 'new'
      });
      if (!existing || existing.length === 0) {
        await base44.entities.Alert.create({
          type: 'low_stock',
          severity: 'medium',
          title: `Low Stock: ${inv.product_name || inv.sku || 'Unknown'}`,
          message: `${inv.store_name}: ${inv.sku} has ${inv.quantity} units (min: ${inv.min_stock_level}). Reorder soon.`,
          entity_type: 'Inventory',
          entity_id: inv.id,
          entity_number: inv.sku || '',
          status: 'new'
        });
        alertsCreated.push('low_stock');
      }
    }

    return Response.json({
      success: true,
      checked: {
        inventory: (inventory || []).length,
        shipments: (shipments || []).length,
        expenses: (expenses || []).length
      },
      anomaliesFound: {
        negative_inventory: negativeStock.length,
        stuck_shipments: stuckShipments.length,
        expense_spike: (thisMonthTotal > 2 * lastMonthTotal && lastMonthTotal > 0) ? 1 : 0,
        duplicate_payment: alertsCreated.filter(a => a === 'duplicate_payment').length,
        low_stock: lowStock.length
      },
      alertsCreated: alertsCreated.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}