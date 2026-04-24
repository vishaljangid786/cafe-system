'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import api from '../services/api';
import { io } from 'socket.io-client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = Cookies.get('token');
        const storedLocation = Cookies.get('selectedLocation');

        if (token) {
          try {
            const res = await api.get('/auth/profile');
            const userData = res.data.data;
            
            setUser(userData);
            
            // Set initial location
            if (storedLocation) {
              try {
                setSelectedLocation(JSON.parse(storedLocation));
              } catch (e) {
                console.error('Invalid stored location');
              }
            } else if (userData.assignedLocation) {
              setSelectedLocation(userData.assignedLocation);
            } else if (userData.accessibleLocations?.length > 0) {
              setSelectedLocation(userData.accessibleLocations[0]);
            }

            initializeSocket(userData._id);
          } catch (error) {
            console.error('Session expired or invalid');
            Cookies.remove('token');
            Cookies.remove('user');
            Cookies.remove('selectedLocation');
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Auth check critical failure', err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const initializeSocket = (userId) => {
    const socketUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';
    const newSocket = io(socketUrl);
    newSocket.on('connect', () => {
      newSocket.emit('join_room', userId);
    });
    setSocket(newSocket);
  };
  
  const switchLocation = (location) => {
    setSelectedLocation(location);
    Cookies.set('selectedLocation', JSON.stringify(location), { expires: 30 });
    // Reload or trigger re-fetch in components
  };

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, ...userData } = res.data.data;

      Cookies.set('token', token, { expires: 30 });
      Cookies.set('user', JSON.stringify(userData), { expires: 30 });

      setUser(userData);
      
      // Set initial location on login
      const initialLoc = userData.assignedLocation || (userData.accessibleLocations?.length > 0 ? userData.accessibleLocations[0] : null);
      if (initialLoc) {
        setSelectedLocation(initialLoc);
        Cookies.set('selectedLocation', JSON.stringify(initialLoc), { expires: 30 });
      }

      initializeSocket(userData._id);

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
    }
  };

  const logout = () => {
    Cookies.remove('token');
    Cookies.remove('user');
    Cookies.remove('selectedLocation');
    setUser(null);
    setSelectedLocation(null);
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    router.push('/login');
  };

  const [globalSearch, setGlobalSearch] = useState('');

  const impersonate = async (userId, viewOnly = false) => {
    try {
      const res = await api.post(`/auth/impersonate/${userId}`, { viewOnly });
      const { token, ...userData } = res.data.data;

      Cookies.set('token', token, { expires: 30 });
      Cookies.set('user', JSON.stringify(userData), { expires: 30 });

      setUser(userData);
      
      const initialLoc = userData.assignedLocation || (userData.accessibleLocations?.length > 0 ? userData.accessibleLocations[0] : null);
      if (initialLoc) {
        setSelectedLocation(initialLoc);
        Cookies.set('selectedLocation', JSON.stringify(initialLoc), { expires: 30 });
      }

      if (socket) {
        socket.disconnect();
      }
      initializeSocket(userData._id);

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
      const { token, ...userData } = res.data.data;

      Cookies.set('token', token, { expires: 30 });
      Cookies.set('user', JSON.stringify(userData), { expires: 30 });

      setUser(userData);
      
      const initialLoc = userData.assignedLocation || (userData.accessibleLocations?.length > 0 ? userData.accessibleLocations[0] : null);
      if (initialLoc) {
        setSelectedLocation(initialLoc);
        Cookies.set('selectedLocation', JSON.stringify(initialLoc), { expires: 30 });
      }

      if (socket) {
        socket.disconnect();
      }
      initializeSocket(userData._id);

      router.push('/dashboard/admin/users');

      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Failed to exit impersonation' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, selectedLocation, switchLocation, globalSearch, setGlobalSearch, loading, login, logout, socket, impersonate, exitImpersonation }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
