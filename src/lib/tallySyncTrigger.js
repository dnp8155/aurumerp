import { base44 } from "@/api/base44Client";

// Fire-and-forget Tally sync for a single record. Non-blocking: failures are
// surfaced in the Tally Sync dashboard, not the calling page. The recovery
// queue (tallySync action=processQueue) re-picks anything this misses.
export function triggerTallySync(entityType, entityId, company) {
  if (!entityType || !entityId) return;
  base44.functions
    .invoke("tallySync", { action: "sync", entity_type: entityType, entity_id: entityId, company })
    .catch(() => {
      // swallowed — recovery queue + dashboard handle failures
    });
}