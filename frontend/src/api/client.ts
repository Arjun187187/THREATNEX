import axios from 'axios';

// Resolve base URL dynamically:
// In Docker production with Nginx reverse proxy, window.location.origin + '/api/v1' or '/api/v1' works natively.
// In dev environments, fallback to VITE_API_URL or relative /api/v1 or host ports.
const getBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    // If frontend is served by Nginx on port 8080/5173 with /api/ reverse proxy
    if (window.location.port === '5173' || window.location.port === '8080' || !window.location.port) {
      return '/api/v1';
    }
  }
  return 'http://localhost:8000/api/v1';
};

export const apiClient = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true, // Enables browser to send and receive HttpOnly cookies
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
