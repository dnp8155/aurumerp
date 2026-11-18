import { base44 } from "@/api/base44Client";
import { CreditCard, CalendarClock, Wrench, RefreshCw } from "lucide-react";

const DAY = 24 * 60 * 60 * 1000;

const startOfDay = (value) => {
  const d = new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const money = (value) => `₹${Math.round(value || 0).toLocaleString("en-IN")}`;

const asArray = (result) => (Array.isArray(result) ? result : (result?.items || []));

const OPEN_RENTAL_STATUSES = ["active", "overdue", "extended"];
const CLOSED_REPAIR_STATUSES = ["delivered", "cancelled", "rejected", "ready_for_delivery"];

export const REMINDER_ICONS = {
  payment_overdue: CreditCard,
  payment_due_soon: CreditCard,
  payment_pending: CreditCard,
  rental_overdue: CalendarClock,
  rental_due_today: CalendarClock,
  repair_ready: Wrench,
  repair_late: Wrench,
  tally_failed: RefreshCw,
};

export async function loadReminders() {
  const [posRes, rentalsRes, repairsRes, failedTally] = await Promise.all([
    base44.entities.PurchaseOrder.list("-created_date", 300),
    base44.entities.Rental.list("-created_date", 300),
    base44.entities.Repair.list("-created_date", 300),
    base44.entities.TallySyncLog.count({ sync_status: "failed" }).catch(() => 0),
  ]);
  const pos = asArray(posRes);
  const rentals = asArray(rentalsRes);
  const repairs = asArray(repairsRes);

  const today = startOfDay(new Date());
  const now = new Date();
  const weekAhead = new Date(today.getTime() + 7 * DAY);
  const reminders = [];

  // Vendor payments (PO due date, not yet paid)
  const unpaid = (pos || []).filter(p => p.status !== "cancelled" && p.payment_status !== "paid");
  const overduePayments = unpaid.filter(p => p.payment_due_date && startOfDay(p.payment_due_date) < today);
  const dueSoonPayments = unpaid.filter(p => {
    if (!p.payment_due_date) return false;
    const d = startOfDay(p.payment_due_date);
    return d >= today && d <= weekAhead;
  });
  const pendingPayouts = unpaid.filter(p => !overduePayments.includes(p) && !dueSoonPayments.includes(p));
  const amountOf = (list) => list.reduce((s, p) => s + (p.payable_amount || p.total_with_gst || p.total_amount || 0), 0);

  if (overduePayments.length) reminders.push({ key: "payment_overdue", level: "critical", count: overduePayments.length, amount: amountOf(overduePayments), path: "/vendor-payouts" });
  if (dueSoonPayments.length) reminders.push({ key: "payment_due_soon", level: "warning", count: dueSoonPayments.length, amount: amountOf(dueSoonPayments), path: "/vendor-payouts" });
  if (pendingPayouts.length) reminders.push({ key: "payment_pending", level: "warning", count: pendingPayouts.length, amount: amountOf(pendingPayouts), path: "/vendor-payouts" });

  // Rental returns
  const openRentals = (rentals || []).filter(r => OPEN_RENTAL_STATUSES.includes(r.status) && r.rental_end_date);
  const overdueRentals = openRentals.filter(r => new Date(r.rental_end_date) < now);
  const dueTodayRentals = openRentals.filter(r => startOfDay(r.rental_end_date).getTime() === today.getTime());

  if (overdueRentals.length) reminders.push({ key: "rental_overdue", level: "critical", count: overdueRentals.length, path: "/rentals" });
  if (dueTodayRentals.length) reminders.push({ key: "rental_due_today", level: "warning", count: dueTodayRentals.length, path: "/rentals" });

  // Repairs ready / past estimated date
  const readyRepairs = (repairs || []).filter(r => r.status === "ready_for_delivery");
  const lateRepairs = (repairs || []).filter(r => r.estimated_completion && !CLOSED_REPAIR_STATUSES.includes(r.status) && startOfDay(r.estimated_completion) < today);

  if (readyRepairs.length) reminders.push({ key: "repair_ready", level: "warning", count: readyRepairs.length, path: "/repairs" });
  if (lateRepairs.length) reminders.push({ key: "repair_late", level: "critical", count: lateRepairs.length, path: "/repairs" });

  // Tally sync failures
  if (failedTally > 0) reminders.push({ key: "tally_failed", level: "warning", count: failedTally, path: "/tally-sync" });

  return reminders;
}

export function describeReminders(reminders, t) {
  return (reminders || []).map(r => ({
    ...r,
    title: `${r.count} ${t(`reminder.${r.key}`)}`,
    detail: r.amount !== undefined ? `${money(r.amount)} ${t("reminder.total_due")}` : "",
  }));
}