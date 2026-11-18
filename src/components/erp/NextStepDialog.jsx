import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { NEXT_STEP_PATHS } from "@/lib/nextSteps";

/**
 * Shows the next step of a workflow after an action completes successfully.
 *
 * Props:
 *  - step: { key, path? } | null — null keeps the dialog closed. `path` overrides
 *    the default page for the step (e.g. a specific repair job).
 *  - onClose: dismiss handler. The primary button closes first, then navigates.
 */
export default function NextStepDialog({ step, onClose }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  if (!step) return null;

  const path = step.path || NEXT_STEP_PATHS[step.key];
  const goNext = () => {
    onClose?.();
    if (path) navigate(path);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t(`next.${step.key}.title`)}</DialogTitle>
          <DialogDescription>{t(`next.${step.key}.msg`)}</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("next.badge")}</p>
          <p className="mt-1 text-sm font-medium">{t(`next.${step.key}.cta`)}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose?.()}>{t("next.stay")}</Button>
          <Button onClick={goNext}>
            {t("next.continue")} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}