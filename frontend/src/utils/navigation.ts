/**
 * Safe Navigation & URL Sanitization Utility
 * Mitigates open-redirect and protocol manipulation vulnerabilities (GHSA-wrjc-x8rr-h8h6 / CVE-2025-68470).
 */

const ALLOWED_ROUTES = new Set([
  '/',
  '/login',
  '/register',
  '/ioc-search',
  '/investigations',
  '/threat-intel',
  '/ai-analyst',
  '/alerts',
  '/watchlists',
  '/reports',
  '/audit-logs',
  '/settings',
]);

/**
 * Validates and sanitizes a target navigation path.
 * Disallows backslashes ('\'), protocol schemes, and unlisted external origins.
 */
export function sanitizeInternalPath(target: string, fallback: string = '/'): string {
  if (!target || typeof target !== 'string') {
    return fallback;
  }

  const clean = target.trim();

  // Block backslash bypasses (e.g., /\evil.com or \login)
  if (clean.includes('\\')) {
    return fallback;
  }

  // Must begin with a single slash, not double slashes (protocol-relative //evil.com)
  if (!clean.startsWith('/') || clean.startsWith('//')) {
    return fallback;
  }

  // Extract path without query parameters or hash for route boundary check
  const pathOnly = clean.split('?')[0].split('#')[0];

  if (!ALLOWED_ROUTES.has(pathOnly)) {
    return fallback;
  }

  return clean;
}
