import axios from 'axios';

// Resolve base URL:
// Using relative '/api/v1' ensures all requests go through the same-origin reverse proxy
// (Nginx in Docker container or Vite dev proxy in local development),
// eliminating host port conflicts (such as Splunk on port 8000) and cross-origin preflight complexity.
const getBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return '/api/v1';
};

export const apiClient = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true, // Enables browser to send and receive HttpOnly cookies
  timeout: 15000, // 15-second timeout to prevent indefinite hanging
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // Anti-CSRF header protection
  },
});

// Response interceptor to handle 401s and automatic token refresh via HttpOnly cookie
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await axios.post(`${getBaseUrl()}/auth/refresh`, {}, {
          withCredentials: true,
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
        return apiClient(originalRequest);
      } catch (refreshErr) {
        if (typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
