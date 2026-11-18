import { secrets } from 'base44:runtime';

// Shared bridge-agent helpers used by both tallySync and bankPaymentBridge.
// Each agent keeps a singleton "last heartbeat" record in its own status entity,
// authenticated by its own bridge-token secret. These helpers factor that out.

export function verifyBridgeToken(secretName: string, token: string | undefined): boolean {
  const expected = secrets.get(secretName);
  if (!expected) return false;
  return !!token && token === expected;
}

export async function getHeartbeat(base44: any, entityName: string): Promise<any> {
  const { items } = await base44.asServiceRole.entities[entityName].filter({}, { limit: 1 });
  return items && items[0] ? items[0] : null;
}

// Upserts the singleton heartbeat. `existing` may be passed to avoid a second
// lookup when the caller already fetched it (e.g. to merge legacy fields).
export async function saveHeartbeat(
  base44: any,
  entityName: string,
  data: any,
  existing?: any
): Promise<void> {
  if (!existing) existing = await getHeartbeat(base44, entityName);
  const payload = { ...data, last_seen: new Date().toISOString() };
  if (existing) {
    await base44.asServiceRole.entities[entityName].update(existing.id, payload).catch(() => {});
  } else {
    await base44.asServiceRole.entities[entityName].create(payload).catch(() => {});
  }
}