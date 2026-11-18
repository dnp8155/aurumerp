import React from "react";
import PageHeader from "@/components/erp/PageHeader";
import TallyExcelExport from "@/components/erp/TallyExcelExport";
import { useI18n } from "@/lib/i18n";

export default function TallyExport() {
  const { t } = useI18n();
  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <PageHeader
        title={t("nav.tally_export")}
        description="Export Sales, Purchase Orders, Inventory, Expenses & Payments to TallyPrime-compatible Excel workbooks"
      />
      <TallyExcelExport />
    </div>
  );
}