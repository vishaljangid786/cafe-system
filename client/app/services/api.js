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
      const publicPaths = ['/login'];
      if (typeof window !== 'undefined' && !publicPaths.includes(window.location.pathname)) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
