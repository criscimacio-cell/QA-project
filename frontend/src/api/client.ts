import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Ensure cookies are sent with every request (httpOnly cookie support)
api.interceptors.request.use((config) => {
  if (config.withCredentials === undefined) {
    config.withCredentials = true;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];

const processQueue = (error: any, token: null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    // Handle network errors (server unreachable, timeout, etc.)
    if (!err.response) {
      const networkError = new Error(
        err.code === 'ECONNABORTED'
          ? 'Request timed out. Please check your connection and try again.'
          : 'Unable to reach the server. Please check your network connection.'
      );
      (networkError as any).isNetworkError = true;
      return Promise.reject(networkError);
    }

    const original = err.config;
    const url = original?.url || '';
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/me') ||
      url.includes('/backoffice/auth/login') ||
      url.includes('/backoffice/auth/me');

    if (err.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      // If a refresh is already in flight, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(original))
          .catch((e) => Promise.reject(e));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        processQueue(null);
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr);
        // Clear any local auth state and redirect to login (only if not already there)
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default api;
