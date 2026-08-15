// Run-once, idempotent bootstrap for Google Search Console ownership of
// dvt.dev (DVT-2996). Replaces the manual Search Console walkthrough that
// used to live in docs/google-search-console.md.
//
// What it does, in order:
//   1. Requests a DNS-TXT site-verification token from the Google Site
//      Verification API for the SA + dvt.dev.
//   2. Creates that TXT record in Cloudflare DNS — ADDITIVE ONLY. It never
//      modifies or deletes any existing record (in particular, the
//      pre-existing `google-site-verification=vhlz4cp_...` TXT, which
//      belongs to a different, personal verification, must survive
//      untouched).
//   3. Calls webResource.insert to complete DNS_TXT verification, retrying
//      with backoff while DNS propagates.
//   4. Adds collin@dvt.dev as a co-owner of the verified resource
//      (best-effort — failure here is logged, not fatal).
//   5. Registers the `sc-domain:dvt.dev` property in Search Console.
//   6. Submits the sitemap (https://dvt.dev/sitemap-index.xml).
//   7. Runs a smoke searchAnalytics.query to confirm the property responds.
//
// Invocation (secrets come from Doppler, never from the shell):
//   doppler run --project dvt --config ops -- node scripts/gsc-bootstrap.mjs
//
// Flags:
//   --dry-run   perform auth + all read calls except the smoke query, print
//               what each write would do, and make no writes.
//
// Required env:
//   GSC_SERVICE_ACCOUNT_JSON  full GCP service-account JSON, as one string
//   CLOUDFLARE_DNS_TOKEN      Cloudflare API token scoped to DNS edit on the
//                             dvt.dev zone
//
// Zero external dependencies: Node 22+ built-ins only (global fetch,
// node:crypto).

import { createSign } from 'node:crypto';

const DRY_RUN = process.argv.includes('--dry-run');

const SITE_VERIFICATION_BASE = 'https://www.googleapis.com/siteVerification/v1';
const WEBMASTERS_BASE = 'https://www.googleapis.com/webmasters/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DOMAIN = 'dvt.dev';
const SC_PROPERTY = 'sc-domain:dvt.dev';
const SITEMAP_URL = 'https://dvt.dev/sitemap-index.xml';
// TODO: move to a shared team account once one exists; for now the only
// human with Search Console access is the founder.
const CO_OWNER = process.env.GSC_CO_OWNER ?? 'collin@dvt.dev';

/** A failure tied to a named bootstrap step, so main() can report cleanly. */
class StepError extends Error {
  constructor(step, message, status) {
    super(`[${step}] ${message}`);
    this.step = step;
    this.status = status;
  }
}

function log(step, message) {
  console.log(`[${step}] ${message}`);
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Truncate a response body for error logs without ever echoing full request payloads. */
function snippet(body, max = 300) {
  if (!body) return '';
  const s = typeof body === 'string' ? body : JSON.stringify(body);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function readServiceAccount() {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new StepError('env', 'missing GSC_SERVICE_ACCOUNT_JSON');
  }
  let sa;
  try {
    sa = JSON.parse(raw);
  } catch {
    throw new StepError('env', 'GSC_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
  if (!sa.client_email || !sa.private_key) {
    throw new StepError('env', 'GSC_SERVICE_ACCOUNT_JSON is missing client_email or private_key');
  }
  return sa;
}

function readCloudflareToken() {
  const token = process.env.CLOUDFLARE_DNS_TOKEN;
  if (!token) {
    throw new StepError('env', 'missing CLOUDFLARE_DNS_TOKEN');
  }
  return token;
}

/** Hand-rolled two-legged OAuth: build + sign a JWT, exchange it for a bearer token. */
async function getGoogleAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope:
      'https://www.googleapis.com/auth/siteverification https://www.googleapis.com/auth/webmasters',
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  let signature;
  try {
    const signer = createSign('RSA-SHA256');
    signer.update(unsigned);
    signer.end();
    signature = signer.sign(sa.private_key).toString('base64');
  } catch {
    // Never log the key or the partial JWT — just that signing failed.
    throw new StepError('auth', 'failed to sign JWT with service-account private key');
  }
  const jwt = `${unsigned}.${signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });

  let res;
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (err) {
    throw new StepError('auth', `token exchange request failed: ${err.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new StepError('auth', `token exchange failed (${res.status}): ${snippet(text)}`);
  }

  const json = await res.json();
  if (!json.access_token) {
    throw new StepError('auth', 'token exchange response had no access_token');
  }
  // Deliberately not logged — never print the bearer token.
  return json.access_token;
}

async function googleFetch(step, accessToken, url, init = {}) {
  let res;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    throw new StepError(step, `request failed: ${err.message}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new StepError(step, `${init.method ?? 'GET'} ${url} -> ${res.status}: ${snippet(text)}`, res.status);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function cfFetch(step, token, url, init = {}) {
  let res;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    throw new StepError(step, `request failed: ${err.message}`);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new StepError(step, `${init.method ?? 'GET'} ${url} -> ${res.status}: ${snippet(json)}`, res.status);
  }
  return json;
}

/** Step 1: get the DNS_TXT verification token for the SA + dvt.dev. */
async function getVerificationToken(accessToken) {
  // POST /token is non-mutating — it just returns a stable token for this SA
  // + domain, so it's safe to call even in dry-run.
  const json = await googleFetch('getToken', accessToken, `${SITE_VERIFICATION_BASE}/token`, {
    method: 'POST',
    body: JSON.stringify({
      verificationMethod: 'DNS_TXT',
      site: { identifier: DOMAIN, type: 'INET_DOMAIN' },
    }),
  });
  if (!json?.token) {
    throw new StepError('getToken', 'response had no token field');
  }
  log('getToken', 'obtained DNS_TXT verification token');
  return json.token;
}

/** Step 2: additive-only TXT record creation in Cloudflare. */
async function ensureCloudflareTxt(cfToken, verificationToken) {
  const zones = await cfFetch(
    'cloudflare-txt',
    cfToken,
    `https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}`
  );
  const zoneId = zones?.result?.[0]?.id;
  if (!zoneId) {
    throw new StepError('cloudflare-txt', `no Cloudflare zone found for ${DOMAIN}`);
  }

  const records = await cfFetch(
    'cloudflare-txt',
    cfToken,
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=TXT&name=${DOMAIN}&per_page=100`
  );
  const existing = (records?.result ?? []).find(
    (r) => String(r.content).replace(/^"|"$/g, '') === verificationToken
  );
  if (existing) {
    log('cloudflare-txt', 'TXT already present');
    return;
  }

  if (DRY_RUN) {
    log('cloudflare-txt', `[dry-run] would create TXT record dvt.dev = <verification token>`);
    return;
  }

  await cfFetch(
    'cloudflare-txt',
    cfToken,
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
    {
      method: 'POST',
      body: JSON.stringify({
        type: 'TXT',
        name: DOMAIN,
        content: verificationToken,
        ttl: 300,
        comment: 'GSC SA verification (DVT-2996)',
      }),
    }
  );
  log('cloudflare-txt', 'created TXT record');
}

/** Step 3: complete DNS_TXT verification, retrying while DNS propagates. */
async function ensureWebResourceVerified(accessToken) {
  const list = await googleFetch('verify', accessToken, `${SITE_VERIFICATION_BASE}/webResource`);
  const already = (list?.items ?? []).find((item) => item.site?.identifier === DOMAIN);
  if (already) {
    log('verify', 'dvt.dev already verified for this service account');
    return already;
  }

  if (DRY_RUN) {
    log('verify', '[dry-run] would call webResource.insert (DNS_TXT) for dvt.dev');
    return null;
  }

  const insertUrl = `${SITE_VERIFICATION_BASE}/webResource?verificationMethod=DNS_TXT`;
  const body = JSON.stringify({ site: { identifier: DOMAIN, type: 'INET_DOMAIN' } });

  const maxTotalMs = 10 * 60 * 1000;
  const start = Date.now();
  let delayMs = 10_000;

  for (;;) {
    let res;
    try {
      res = await fetch(insertUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body,
      });
    } catch (err) {
      throw new StepError('verify', `webResource.insert request failed: ${err.message}`);
    }

    if (res.ok) {
      const json = await res.json();
      log('verify', 'dvt.dev verified via DNS_TXT');
      return json;
    }

    const text = await res.text().catch(() => '');
    const retryable = res.status === 400 || res.status >= 500;
    const elapsed = Date.now() - start;

    if (!retryable || elapsed + delayMs > maxTotalMs) {
      throw new StepError(
        'verify',
        `webResource.insert failed (${res.status}) after ${Math.round(elapsed / 1000)}s: ${snippet(text)}`
      );
    }

    log(
      'verify',
      `webResource.insert not ready yet (${res.status}), retrying in ${Math.round(delayMs / 1000)}s`
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(delayMs * 2, 120_000);
  }
}

/**
 * Step 4: add collin@dvt.dev as co-owner. Best-effort — never fatal.
 * Returns true only when ownership is confirmed (already an owner, or the
 * PUT succeeded); returns false on any skip/failure so main() can report
 * honestly instead of implying success.
 */
async function ensureCoOwner(accessToken, resourceId) {
  if (!resourceId) {
    log('co-owner', DRY_RUN ? '[dry-run] skipped (no verified resource yet)' : 'skipped (no resource id)');
    return DRY_RUN ? true : false;
  }
  let resource;
  try {
    resource = await googleFetch(
      'co-owner',
      accessToken,
      `${SITE_VERIFICATION_BASE}/webResource/${encodeURIComponent(resourceId)}`
    );
  } catch (err) {
    log('co-owner', `best-effort: could not read resource (${err.message}); continuing`);
    return false;
  }

  const owners = resource?.owners ?? [];
  if (owners.includes(CO_OWNER)) {
    log('co-owner', `${CO_OWNER} already an owner`);
    return true;
  }

  if (DRY_RUN) {
    log('co-owner', `[dry-run] would add ${CO_OWNER} as owner`);
    return true;
  }

  try {
    await googleFetch(
      'co-owner',
      accessToken,
      `${SITE_VERIFICATION_BASE}/webResource/${encodeURIComponent(resourceId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ ...resource, owners: [...owners, CO_OWNER] }),
      }
    );
    log('co-owner', `added ${CO_OWNER} as owner`);
    return true;
  } catch (err) {
    // Co-ownership is best-effort, not a hard failure.
    log('co-owner', `best-effort: failed to add co-owner (${err.message}); continuing`);
    return false;
  }
}

/** Step 5: register the sc-domain:dvt.dev Search Console property. */
async function ensureSearchConsoleProperty(accessToken) {
  if (DRY_RUN) {
    log('sc-property', `[dry-run] would PUT sites/${SC_PROPERTY}`);
    return;
  }
  const url = `${WEBMASTERS_BASE}/sites/${encodeURIComponent(SC_PROPERTY)}`;
  try {
    await googleFetch('sc-property', accessToken, url, { method: 'PUT' });
    log('sc-property', `${SC_PROPERTY} added`);
  } catch (err) {
    if (err instanceof StepError && err.status === 409) {
      log('sc-property', `${SC_PROPERTY} already added`);
      return;
    }
    throw err;
  }
}

/** Step 6: submit the sitemap (idempotent by design). */
async function submitSitemap(accessToken) {
  if (DRY_RUN) {
    log('sitemap', `[dry-run] would PUT sitemaps/${SITEMAP_URL}`);
    return;
  }
  const url = `${WEBMASTERS_BASE}/sites/${encodeURIComponent(SC_PROPERTY)}/sitemaps/${encodeURIComponent(SITEMAP_URL)}`;
  await googleFetch('sitemap', accessToken, url, { method: 'PUT' });
  log('sitemap', `submitted ${SITEMAP_URL}`);
}

/** Step 7: smoke-query analytics to confirm the property responds. */
async function smokeQuery(accessToken) {
  if (DRY_RUN) {
    log('smoke', '[dry-run] would POST searchAnalytics/query for last 7 days');
    return;
  }
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);

  const url = `${WEBMASTERS_BASE}/sites/${encodeURIComponent(SC_PROPERTY)}/searchAnalytics/query`;
  const json = await googleFetch('smoke', accessToken, url, {
    method: 'POST',
    body: JSON.stringify({
      startDate: fmt(start),
      endDate: fmt(end),
      dimensions: ['query'],
      rowLimit: 5,
    }),
  });
  const rows = json?.rows?.length ?? 0;
  log('smoke', `searchAnalytics.query ok (${rows} row${rows === 1 ? '' : 's'})`);
}

async function main() {
  if (DRY_RUN) {
    log('main', 'dry-run mode: read calls only, no writes');
  }

  const sa = readServiceAccount();
  const cfToken = readCloudflareToken();
  const accessToken = await getGoogleAccessToken(sa);
  log('auth', 'obtained Google access token');

  const verificationToken = await getVerificationToken(accessToken);
  await ensureCloudflareTxt(cfToken, verificationToken);
  const resource = await ensureWebResourceVerified(accessToken);
  // resource?.site?.identifier is deliberately not used as a fallback here:
  // it 404s against the webResource endpoint (which expects the resource
  // id), and that failure was being swallowed as best-effort.
  const coOwnerConfirmed = await ensureCoOwner(accessToken, resource?.id);
  await ensureSearchConsoleProperty(accessToken);
  await submitSitemap(accessToken);
  await smokeQuery(accessToken);

  console.log(DRY_RUN ? 'bootstrap complete (dry-run — no writes made)' : 'bootstrap complete');
  if (!coOwnerConfirmed) {
    console.log(
      [
        '',
        `WARNING: ${CO_OWNER} was NOT added as a Search Console owner —`,
        're-run the script or add manually via the Site Verification API',
      ].join('\n')
    );
  }
}

main().catch((err) => {
  if (err instanceof StepError) {
    console.error(`bootstrap failed at step "${err.step}": ${err.message}`);
  } else {
    console.error(`bootstrap failed: ${err.message}`);
  }
  process.exit(1);
});
