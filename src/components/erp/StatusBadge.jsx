import React from "react";
import { cn } from "@/lib/utils";

const statusConfig = {
  pending_approval: { label: "Pending Approval", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  approved: { label: "Approved", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  rejected: { label: "Rejected", className: "bg-red-50 text-red-700 ring-red-200" },
  received: { label: "Received", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  partially_received: { label: "Split", className: "bg-orange-50 text-orange-700 ring-orange-200" },
  draft: { label: "Draft", className: "bg-slate-100 text-slate-600 ring-slate-200" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-500 ring-slate-200" },
  pending_qc: { label: "Pending QC", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  qc_in_progress: { label: "QC In Progress", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  qc_completed: { label: "QC Completed", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  discrepancy: { label: "Discrepancy", className: "bg-red-50 text-red-700 ring-red-200" },
  cataloged: { label: "Cataloged", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  allocated: { label: "Allocated", className: "bg-violet-50 text-violet-700 ring-violet-200" },
  active: { label: "Active", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  discontinued: { label: "Discontinued", className: "bg-slate-100 text-slate-500 ring-slate-200" },
  pending: { label: "Pending", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  dispatched: { label: "Dispatched", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  in_transit: { label: "In Transit", className: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  created: { label: "Created", className: "bg-slate-100 text-slate-600 ring-slate-200" },
  unpaid: { label: "Unpaid", className: "bg-red-50 text-red-700 ring-red-200" },
  partial: { label: "Split", className: "bg-orange-50 text-orange-700 ring-orange-200" },
  paid: { label: "Paid", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  success: { label: "Success", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  failed: { label: "Failed", className: "bg-red-50 text-red-700 ring-red-200" },
  head_office: { label: "Head Office", className: "bg-violet-50 text-violet-700 ring-violet-200" },
  store: { label: "Store", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  warehouse: { label: "Warehouse", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  green: { label: "Fresh", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  amber: { label: "Aging", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  red: { label: "Old Stock", className: "bg-red-50 text-red-700 ring-red-200" },
  inactive: { label: "Inactive", className: "bg-slate-100 text-slate-500 ring-slate-200" },
};

export default function StatusBadge({ status, label }) {
  const config = statusConfig[status] || { label: status, className: "bg-slate-100 text-slate-600 ring-slate-200" };
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
      config.className
    )}>
      {label || config.label}
    </span>
  );
}