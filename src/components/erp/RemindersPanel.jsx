import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCircle2, ChevronRight } from "lucide-react";
import { loadReminders, describeReminders, REMINDER_ICONS } from "@/lib/reminders";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LEVEL_STYLES = {
  critical: "bg-red-50 text-red-600",
  warning: "bg-amber-50 text-amber-600",
  info: "bg-blue-50 text-blue-600",
};

export default function RemindersPanel() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    loadReminders()
      .then(setReminders)
      .catch(() => setReminders([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-28 rounded-xl bg-muted animate-pulse mb-6" />;

  const items = describeReminders(reminders, t);

  return (
    <div className="rounded-xl border mb-6">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Bell className="h-4 w-4 text-amber-600" />
        <p className="text-sm font-semibold">{t("reminder.title")}</p>
        {items.length > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">{items.length}</span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{t("reminder.desc")}</span>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          {t("reminder.none")}
        </div>
      ) : (
        <div className="divide-y">
          {items.map(item => {
            const Icon = REMINDER_ICONS[item.key] || Bell;
            return (
              <Link
                key={item.key}
                to={item.path}
                className="flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors"
              >
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", LEVEL_STYLES[item.level])}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  {item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}