/**
 * Safe, user-friendly API error formatter for THREATNEX.
 * Prevents raw stack traces, internal paths, or unparsed JSON objects
 * from leaking to user-facing error banners.
 */

export function formatApiError(err: any, fallbackMessage?: string): string {
  if (!err) {
    return fallbackMessage || 'An unexpected error occurred. Please try again.';
  }

  // Network / Proxy / Connection failure (no HTTP response received)
  if (!err.response) {
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return 'Request timed out while contacting the THREATNEX backend service. Please try again.';
    }
    return 'Cannot reach the THREATNEX backend service. Please verify network connectivity and that backend containers are running.';
  }

  const { status, data } = err.response;

  // 422 Unprocessable Entity - Pydantic schema validation errors
  if (status === 422) {
    if (Array.isArray(data?.detail)) {
      const messages = data.detail.map((item: any) => {
        const fieldName = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : 'Field';
        const formattedField =
          typeof fieldName === 'string'
            ? fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace('_', ' ')
            : 'Field';
        const cleanMsg = item.msg?.replace(/^Value error,\s*/i, '') || 'Invalid input';
        return `${formattedField}: ${cleanMsg}`;
      });
      return messages.join(' • ');
    }
    if (typeof data?.detail === 'string') {
      return data.detail;
    }
    return 'Invalid form data provided. Please verify all fields match the required formats.';
  }

  // 400 Bad Request / 409 Conflict (e.g., duplicate username or email)
  if (status === 400 || status === 409) {
    const detail = typeof data?.detail === 'string' ? data.detail : '';
    if (/already registered/i.test(detail)) {
      return 'Email address is already registered. Please log in or use a different email.';
    }
    if (/already taken/i.test(detail)) {
      return 'Username is already taken. Please choose another operator identifier.';
    }
    if (detail) {
      return detail;
    }
    return 'Registration request could not be processed. Please verify your details.';
  }

  // 401 Unauthorized
  if (status === 401) {
    return data?.detail || 'Authentication failed. Please verify your operator credentials.';
  }

  // 403 Forbidden (CSRF, inactive account, or role authorization)
  if (status === 403) {
    return data?.detail || 'Access denied: You do not have permission to perform this action.';
  }

  // 429 Too Many Requests (Rate limit backoff)
  if (status === 429) {
    return 'Rate limit exceeded. Too many requests have been made from your IP address. Please wait a moment before trying again.';
  }

  // 500 / 502 / 503 Server & Gateway Errors
  if (status >= 500) {
    return 'Security service temporarily unavailable. Please try again shortly or contact the SecOps administrator.';
  }

  // Fallback
  return (
    (typeof data?.detail === 'string' ? data.detail : null) ||
    'Request failed. Please check your inputs and try again.'
  );
}
