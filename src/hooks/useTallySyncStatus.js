import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const STATUSES = ["success", "failed", "retry", "pending"];
const VISIBLE_LOGS = 8;
// A sync burst writes many log rows at once, so counts are re-read only after
// the burst settles and never more often than the cooldown. Counts use plain
// per-status count() calls rather than grouped scans, which keeps the dashboard
// off the scarcer scan budget entirely. Visible rows update from the realtime
// events themselves, so the list still reacts instantly.
const COUNTS_QUIET_MS = 1200;
const COUNTS_COOLDOWN_MS = 30000;

const emptyCounts = () => STATUSES.reduce((acc, status) => ({ ...acc, [status]: 0 }), {});

export default function useTallySyncStatus() {
  const [counts, setCounts] = useState(emptyCounts);
  const [logs, setLogs] = useState([]);
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef(null);
  const logsRef = useRef([]);
  const lastCountsAt = useRef(Date.now());

  // One cheap count per status — never a scan. A status that fails to load keeps
  // its previous value instead of breaking the panel.
  const loadCounts = useCallback(async () => {
    const results = await Promise.all(
      STATUSES.map((status) => base44.entities.TallySyncLog.count({ sync_status: status }).catch(() => null))
    );
    setCounts((prev) => {
      const next = { ...prev };
      STATUSES.forEach((status, i) => {
        if (typeof results[i] === "number") next[status] = results[i];
      });
      return next;
    });
  }, []);

  const loadLogs = useCallback(async () => {
    const page = await base44.entities.TallySyncLog.filter({}, { sort: "-created_date", limit: VISIBLE_LOGS });
    logsRef.current = page.items || [];
    setLogs(logsRef.current);
  }, []);

  const loadAgent = useCallback(async () => {
    const page = await base44.entities.TallyAgentStatus.list({ sort: "-last_seen", limit: 1 });
    setAgent(page.items?.[0] || null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadCounts(), loadLogs(), loadAgent()]);
      } catch (err) {
        console.error("Tally sync status load error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadCounts, loadLogs, loadAgent]);

  useEffect(() => {
    const scheduleCounts = () => {
      if (refreshTimer.current) return;
      const sinceLast = Date.now() - lastCountsAt.current;
      const delay = Math.max(COUNTS_QUIET_MS, COUNTS_COOLDOWN_MS - sinceLast);
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        lastCountsAt.current = Date.now();
        loadCounts();
      }, delay);
    };

    const applyDelta = (known, data) => {
      setCounts((prev) => {
        const next = { ...prev };
        const bump = (status, by) => {
          if (!status || !(status in next)) return;
          next[status] = Math.max(0, next[status] + by);
        };
        bump(data.sync_status, 1);
        if (known && known.sync_status !== data.sync_status) bump(known.sync_status, -1);
        return next;
      });
    };

    const unsubscribeLogs = base44.entities.TallySyncLog.subscribe((event) => {
      const { type, data } = event;
      if (!data) return;

      const known = logsRef.current.find((l) => l.id === data.id);
      let next;
      if (type === "delete") {
        next = logsRef.current.filter((l) => l.id !== data.id);
      } else if (known) {
        next = logsRef.current.map((l) => (l.id === data.id ? { ...l, ...data } : l));
      } else {
        next = [data, ...logsRef.current].slice(0, VISIBLE_LOGS);
      }
      logsRef.current = next;
      setLogs(next);

      if (type === "delete") {
        const status = known?.sync_status;
        setCounts((prev) => (status && status in prev
          ? { ...prev, [status]: Math.max(0, prev[status] - 1) }
          : prev));
      } else {
        applyDelta(known, data);
      }
      scheduleCounts();
    });

    const unsubscribeAgent = base44.entities.TallyAgentStatus.subscribe((event) => {
      if (event.data) setAgent(event.data);
    });

    return () => {
      unsubscribeLogs();
      unsubscribeAgent();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [loadCounts]);

  return { counts, logs, agent, loading };
}