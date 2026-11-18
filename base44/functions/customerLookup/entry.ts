import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { normalizeIndianMobile, phoneVariants } from '../../shared/phoneNormalize.js';

// Extracts a name from an arbitrary lookup-provider JSON response.
function extractName(data) {
  if (!data) return null;
  const candidates = [
    data.name, data.full_name, data.caller_name, data.customer_name,
    data.first_name, data.firstName, data.display_name,
    data?.data?.name, data?.data?.full_name, data?.data?.caller_name,
    data?.result?.name, data?.result?.full_name,
    data?.data?.[0]?.name, data?.results?.[0]?.name,
  ];
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim()) return c.trim();
  }
  const fn = data.first_name || data?.data?.first_name;
  const ln = data.last_name || data?.data?.last_name;
  if (fn || ln) return [fn, ln].filter(Boolean).join(' ').trim() || null;
  return null;
}

function extractEmail(data) {
  if (!data) return null;
  return data.email || data?.data?.email || data?.result?.email || null;
}

function extractAddress(data) {
  if (!data) return null;
  const a = data.address || data?.data?.address || data?.result?.address;
  if (a && typeof a === 'string') return a.trim();
  const parts = [data.city, data.state, data.zipcode, data.pincode].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return null;
}

export default async function(req) {
  let base44, user;
  try {
    base44 = createClientFromRequest(req);
    user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const raw = body.phone;
    const phone = normalizeIndianMobile(raw);
    if (!phone) return Response.json({ error: 'Invalid Indian mobile number' }, { status: 400 });

    // 1) Search existing Customer database (all common storage variants).
    try {
      const found = await base44.asServiceRole.entities.Customer.filter({
        phone: { $in: phoneVariants(phone) },
        status: { $ne: 'inactive' }
      });
      if (found && found.length > 0) {
        const c = found[0];
        return Response.json({
          source: 'database',
          phone,
          name: c.name || null,
          email: c.email || null,
          address: [c.address_line1, c.address_line2, c.address_area, c.city, c.state, c.pincode].filter(Boolean).join(', ') || null,
          customer_id: c.id
        });
      }
    } catch (e) { /* Customer entity read failed — fall through to cache/api */ }

    // 2) Check local cache.
    try {
      const cached = await base44.asServiceRole.entities.PhoneLookupCache.filter({ phone });
      if (cached && cached.length > 0) {
        const c = cached[0];
        return Response.json({
          source: 'cache',
          phone,
          name: c.name || null,
          email: c.email || null,
          address: c.address || null
        });
      }
    } catch (e) { /* cache miss / entity missing */ }

    // 3) External lookup.
    const apiUrl = secrets.get('PHONE_LOOKUP_API_URL');
    const apiKey = secrets.get('PHONE_LOOKUP_API_KEY');
    if (!apiUrl) {
      return Response.json({
        source: 'none',
        phone,
        configured: false,
        message: 'Phone lookup not configured. Add PHONE_LOOKUP_API_URL and PHONE_LOOKUP_API_KEY in Dashboard → Secrets.'
      });
    }

    let url = apiUrl.replace(/\{phone\}/g, phone);
    const keyInUrl = url.includes('{key}');
    if (keyInUrl) url = url.replace(/\{key\}/g, encodeURIComponent(apiKey || ''));

    const headers = { 'Accept': 'application/json' };
    const host = new URL(url).hostname;
    if (host.endsWith('rapidapi.com')) {
      headers['X-RapidAPI-Key'] = apiKey || '';
      headers['X-RapidAPI-Host'] = host;
    } else if (!keyInUrl && apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const resp = await fetch(url, { headers });
    let data = null;
    try {
      const text = await resp.text();
      data = JSON.parse(text);
    } catch (e) {
      data = { name: null };
    }

    if (!resp.ok) {
      return Response.json({
        source: 'none',
        phone,
        configured: true,
        not_found: resp.status === 404,
        message: `Lookup provider returned ${resp.status}`
      });
    }

    const name = extractName(data);
    const email = extractEmail(data);
    const address = extractAddress(data);

    if (!name) {
      return Response.json({
        source: 'none',
        phone,
        configured: true,
        not_found: true,
        message: 'No name returned for this number'
      });
    }

    // Save to cache (best-effort).
    try {
      await base44.asServiceRole.entities.PhoneLookupCache.create({
        phone,
        name,
        email: email || undefined,
        address: address || undefined,
        source: 'api',
        looked_up_at: new Date().toISOString()
      });
    } catch (e) { /* cache write failure is non-fatal */ }

    return Response.json({
      source: 'api',
      phone,
      name,
      email,
      address
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}