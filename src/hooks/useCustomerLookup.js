import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { normalizeIndianMobile } from "@/lib/phoneNormalizeClient";

// Debounced customer lookup by mobile number.
// Returns { status, data, error, reset } where status is one of:
// 'idle' | 'loading' | 'found' | 'not_found' | 'error' | 'unconfigured'
export function useCustomerLookup(phone, debounceMs = 600) {
  const [status, setStatus] = useState("idle");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reqId = useRef(0);
  const cache = useRef(new Map());

  const reset = useCallback(() => {
    setStatus("idle");
    setData(null);
    setError(null);
  }, []);

  useEffect(() => {
    const normalized = normalizeIndianMobile(phone);
    if (!normalized) {
      setStatus("idle");
      setData(null);
      setError(null);
      return;
    }

    // session cache — avoid repeat calls for the same number in one session
    if (cache.current.has(normalized)) {
      const cached = cache.current.get(normalized);
      setStatus(cached.status);
      setData(cached.data);
      setError(cached.error);
      return;
    }

    const myId = ++reqId.current;
    setStatus("loading");
    setData(null);
    setError(null);

    const timer = setTimeout(async () => {
      if (myId !== reqId.current) return;
      try {
        const res = await base44.functions.invoke("customerLookup", { phone: normalized });
        const d = res.data;
        if (myId !== reqId.current) return;

        if (d.error) {
          setStatus("error");
          setError(d.error);
          cache.current.set(normalized, { status: "error", data: null, error: d.error });
          return;
        }

        if (d.source && d.source !== "none" && d.name) {
          setStatus("found");
          setData(d);
          cache.current.set(normalized, { status: "found", data: d, error: null });
        } else if (d.configured === false) {
          setStatus("unconfigured");
          setData(d);
          cache.current.set(normalized, { status: "unconfigured", data: d, error: null });
        } else {
          setStatus("not_found");
          setData(d);
          cache.current.set(normalized, { status: "not_found", data: d, error: null });
        }
      } catch (err) {
        if (myId !== reqId.current) return;
        setStatus("error");
        setError(err?.message || "Lookup failed");
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [phone, debounceMs]);

  return { status, data, error, reset };
}