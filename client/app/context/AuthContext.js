'use client';
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import api from '../services/api';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = Cookies.get('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
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
      console.error('Failed to load global locations');
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

  const checkAuth = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/profile');
      if (res.data.success) {
        const userData = res.data.data;
        setUser(userData);
        Cookies.set('user', JSON.stringify(userData), { expires: 7 });

        // Recover Location & Socket
        const storedLocation = Cookies.get('selectedLocation');
        let initialLocation = null;
        
        if (storedLocation) {
          try {
            initialLocation = JSON.parse(storedLocation);
            setSelectedLocation(initialLocation);
          } catch (e) {
            console.error('Invalid stored location');
          }
        } else if (userData.assignedLocation) {
          initialLocation = userData.assignedLocation;
          setSelectedLocation(initialLocation);
        } else if (userData.accessibleLocations?.length > 0) {
          initialLocation = userData.accessibleLocations[0];
          setSelectedLocation(initialLocation);
        }

        initializeSocket(userData, initialLocation);
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        console.error('Session verification failed:', err.response?.data?.message || err.message);
      }
      setUser(null);
      Cookies.remove('user');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      checkAuth();
      fetchLocations();
    }, 0);
    
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
      Cookies.set('user', JSON.stringify(userData), { expires: 7 });
      
      // Set initial location on login
      const initialLoc = userData.assignedLocation || (userData.accessibleLocations?.length > 0 ? userData.accessibleLocations[0] : null);
      if (initialLoc) {
        setSelectedLocation(initialLoc);
        Cookies.set('selectedLocation', JSON.stringify(initialLoc), { expires: 30 });
      }

      initializeSocket(userData, initialLoc);
      
      toast.success(`Welcome back, ${userData.name}`);

      if (userData.role === 'super_admin' || userData.role === 'admin') {
        router.push('/dashboard/admin');
      } else if (userData.role === 'branch_admin') {
        router.push('/dashboard/branch-admin');
      } else if (userData.role === 'chef') {
        router.push('/dashboard/chef');
      } else {
        router.push('/dashboard/staff');
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Login failed' 
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    Cookies.remove('user');
    Cookies.remove('selectedLocation');
    setUser(null);
    setSelectedLocation(null);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
    }
    router.push('/login');
  };

  const [globalSearch, setGlobalSearch] = useState('');

  const impersonate = async (userId, viewOnly = false) => {
    try {
      const res = await api.post(`/auth/impersonate/${userId}`, { viewOnly });
      const userData = res.data.data;
      Cookies.set('user', JSON.stringify(userData), { expires: 30 });

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

      if (userData.role === 'super_admin' || userData.role === 'admin') {
        router.push('/dashboard/admin');
      } else if (userData.role === 'branch_admin') {
        router.push('/dashboard/branch-admin');
      } else if (userData.role === 'chef') {
        router.push('/dashboard/chef');
      } else {
        router.push('/dashboard/staff');
      }

      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Impersonation failed' };
    }
  };

  const exitImpersonation = async () => {
    try {
      const res = await api.post('/auth/exit-impersonation');
      const userData = res.data.data;
      Cookies.set('user', JSON.stringify(userData), { expires: 30 });

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
      return { success: false, message: error.response?.data?.message || 'Failed to exit impersonation' };
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
