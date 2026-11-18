import React, { useRef } from "react";
import { Dialog } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

/**
 * Wraps a data-entry Dialog so that closing it (overlay click, X, or ESC)
 * while the form is "dirty" prompts a confirmation first.
 *
 * Props:
 *  - open, onOpenChange: standard controlled Dialog props
 *  - isDirty: boolean — true when the user has entered/changed data
 *  - title / description: optional confirm copy overrides
 *
 * A controlled close (parent sets open=false after a successful save) does NOT
 * trigger the confirm, because that path bypasses onOpenChange.
 */
export default function ConfirmCloseDialog({
  open,
  onOpenChange,
  isDirty,
  title = "बंद करें? आपका डेटा हट जाएगा",
  description = "आपने कुछ डेटा भरा है। बिना सेव के बंद करने पर वह हट जाएगा। क्या आप निश्चित हैं?",
  confirmLabel = "बंद करें",
  cancelLabel = "फॉर्म पर रहें",
  children,
  ...rest
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  // keep latest isDirty in a ref so the save path (which may flip isDirty and
  // open in the same batch) never sees a stale true value.
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  const handleOpenChange = (next) => {
    if (!next && dirtyRef.current) {
      setConfirmOpen(true);
      return;
    }
    onOpenChange?.(next);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange} {...rest}>
        {children}
      </Dialog>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => onOpenChange?.(false)}>
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}