import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

export const base44 = createClient({
  appId,
  ...(token ? {
    token,
    headers: {
      Authorization: `Bearer ${token}`
    }
  } : {}),
  functionsVersion,
  appBaseUrl
});

if (token && typeof window !== 'undefined') {
  try {
    base44.auth.setToken(token);
  } catch (e) {
    console.warn('Failed to set base44 auth token:', e);
  }
}
