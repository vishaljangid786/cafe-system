'use client';
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import api from '../services/api';
import logger from '../services/logger';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const router = useRouter();

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data);
      return res.data.data;
    } catch (err) {
      logger.error('Failed to load global locations');
      return [];
    }
  };

  const initializeSocket = (userData, locationOverride = null) => {
    if (!userData) return;
    
    // Disconnect existing socket if any
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socketUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';
    const newSocket = io(socketUrl, { withCredentials: true });
    newSocket.on('connect', () => {
      const activeLocation = locationOverride || selectedLocation;
      const branchId = activeLocation?._id || activeLocation || userData.assignedLocation?._id || userData.assignedLocation;
      newSocket.emit('join_session', { branchId });
    });
    socketRef.current = newSocket;
    setSocket(newSocket);
  };

  // Single source of truth for role-based dashboard routing
  const getRoleDashboard = (role) => {
    const map = {
      super_admin: '/dashboard/admin',
      admin: '/dashboard/admin',
      branch_admin: '/dashboard/branch-admin',
      chef: '/dashboard/chef',
      staff: '/dashboard/staff',
    };
    return map[role] || '/dashboard/staff';
  };

  const checkAuth = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/profile');
      if (res.data.success) {
        const userData = res.data.data;
        setUser(userData);
        // Do NOT persist full user object in a readable cookie — use in-memory state only.
        // The server-side httpOnly JWT cookie is the actual auth token.

        // Recover Location & Socket — only runs when session is confirmed.
        const storedLocation = Cookies.get('selectedLocation');
        let initialLocation = null;

        if (storedLocation) {
          try {
            initialLocation = JSON.parse(storedLocation);
            setSelectedLocation(initialLocation);
          } catch (e) {
            logger.error('Invalid stored location');
          }
        } else if (userData.assignedLocation) {
          initialLocation = userData.assignedLocation;
          setSelectedLocation(initialLocation);
        } else if (userData.accessibleLocations?.length > 0) {
          initialLocation = userData.accessibleLocations[0];
          setSelectedLocation(initialLocation);
        }

        initializeSocket(userData, initialLocation);
        // Fetch locations only after session is confirmed to avoid unauthenticated API calls.
        await fetchLocations();
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        logger.error('Session verification failed:', err.response?.data?.message || err.message);
      }
      setUser(null);
      Cookies.remove('user');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // fetchLocations is called inside checkAuth after session is confirmed.
    // Calling it here unconditionally caused "Failed to load global locations"
    // errors for unauthenticated users (e.g., on the login page).
    const timer = setTimeout(() => checkAuth(), 0);

    return () => {
      clearTimeout(timer);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      setSocket(null);
    };
  }, []);
  
  const switchLocation = (location) => {
    setSelectedLocation(location);
    Cookies.set('selectedLocation', JSON.stringify(location), { expires: 30 });
    
    if (socketRef.current && user) {
      socketRef.current.emit('join_session', { branchId: location._id || location });
    }
  };

  const login = async (email, password) => {
    try {
      setLoading(true);
      const res = await api.post('/auth/login', { email, password });
      const userData = res.data.data;

      setUser(userData);
      // Do NOT store full user object in readable cookie (XSS risk).
      // In-memory state + server httpOnly JWT cookie is sufficient.

      const initialLoc = userData.assignedLocation || (userData.accessibleLocations?.length > 0 ? userData.accessibleLocations[0] : null);
      if (initialLoc) {
        setSelectedLocation(initialLoc);
        Cookies.set('selectedLocation', JSON.stringify(initialLoc), { expires: 30 });
      }

      initializeSocket(userData, initialLoc);
      await fetchLocations();
      toast.success(`Welcome back, ${userData.name}`);
      router.push(getRoleDashboard(userData.role));

      return { success: true };
    } catch (error) {
      setLoading(false);
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed'
      };
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await api.get('/auth/logout');
    } catch (err) {
      logger.error('Backend logout failed');
    }
    
    Cookies.remove('user');
    Cookies.remove('selectedLocation');
    Cookies.remove('token'); // In case it was not httpOnly
    
    setUser(null);
    setSelectedLocation(null);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
    }
    setLoading(false);
    router.push('/login');
  };

  const [globalSearch, setGlobalSearch] = useState('');

  const impersonate = async (userId, viewOnly = false) => {
    try {
      setLoading(true);
      const res = await api.post(`/auth/impersonate/${userId}`, { viewOnly });
      const userData = res.data.data;
      setUser(userData);

      const initialLoc = userData.assignedLocation || (userData.accessibleLocations?.length > 0 ? userData.accessibleLocations[0] : null);
      if (initialLoc) {
        setSelectedLocation(initialLoc);
        Cookies.set('selectedLocation', JSON.stringify(initialLoc), { expires: 30 });
      }

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      initializeSocket(userData, initialLoc);
      router.push(getRoleDashboard(userData.role));

      return { success: true };
    } catch (error) {
      setLoading(false);
      return { success: false, message: error.response?.data?.message || 'Failed to login as staff' };
    }
  };

  const exitImpersonation = async () => {
    try {
      setLoading(true);
      const res = await api.post('/auth/exit-impersonation');
      const userData = res.data.data;
      setUser(userData);

      const initialLoc = userData.assignedLocation || (userData.accessibleLocations?.length > 0 ? userData.accessibleLocations[0] : null);
      if (initialLoc) {
        setSelectedLocation(initialLoc);
        Cookies.set('selectedLocation', JSON.stringify(initialLoc), { expires: 30 });
      }

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      initializeSocket(userData, initialLoc);
      router.push('/dashboard/admin/users');

      return { success: true };
    } catch (error) {
      setLoading(false);
      return { success: false, message: error.response?.data?.message || 'Failed to logout from member' };
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      setUser, 
      selectedLocation, 
      switchLocation, 
      locations, 
      refreshLocations: fetchLocations,
      globalSearch, 
      setGlobalSearch, 
      loading, 
      login, 
      logout, 
      socket, 
      impersonate, 
      exitImpersonation 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
