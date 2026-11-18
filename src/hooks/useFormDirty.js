import { useEffect, useRef, useState } from "react";

/**
 * Reports whether a dialog form has unsaved changes since it was opened.
 * `value` is any JSON-serialisable snapshot of the form state (object or array).
 * The baseline is captured when the dialog opens, so a form that is pre-filled
 * for editing does not count as dirty until the user actually changes something.
 */
export default function useFormDirty(isOpen, value) {
  const [dirty, setDirty] = useState(false);
  const baselineRef = useRef(null);
  const snapshot = JSON.stringify(value);

  useEffect(() => {
    if (!isOpen) {
      baselineRef.current = null;
      setDirty(false);
      return;
    }
    if (baselineRef.current === null) {
      baselineRef.current = snapshot;
      return;
    }
    setDirty(snapshot !== baselineRef.current);
  }, [isOpen, snapshot]);

  return dirty;
}