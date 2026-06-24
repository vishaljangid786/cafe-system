import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  // httpOnly cookie is automatically sent with every request — no manual token needed
  withCredentials: true,
});

// Response Interceptor: Handle Global Errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('selectedLocation');
      // Public pages must never be bounced to /login on a 401. The /auth/profile
      // probe legitimately 401s for logged-out visitors browsing these pages.
      const publicPaths = ['/login', '/signup', '/bookings', '/order', '/feedback'];
      const onPublicPath = typeof window !== 'undefined' &&
        publicPaths.some((p) => window.location.pathname === p || window.location.pathname.startsWith(`${p}/`));
      const isProfileProbe = error.config?.url?.includes('/auth/profile');
      if (typeof window !== 'undefined' && !onPublicPath && !isProfileProbe) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
