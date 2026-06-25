'use client';
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import api from '../services/api';
import logger from '../services/logger';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import getSocketUrl from '../services/socketUrl';
import { progress } from '../components/ui/TopProgressBar';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedLocationIds, setSelectedLocationIds] = useState([]); // [] = all, [id1, id2] = subset
  const [locations, setLocations] = useState([]);
  const [cafes, setCafes] = useState([]);
  const [selectedCafe, setSelectedCafe] = useState('all'); // 'all' | cafeId — scopes the branch selector
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const router = useRouter();

  const getUserBranchIds = (userData) => {
    if (!userData) return [];
    const ids = [];
    if (userData.assignedLocation) ids.push(userData.assignedLocation._id || userData.assignedLocation);
    if (Array.isArray(userData.accessibleLocations)) {
      userData.accessibleLocations.forEach((loc) => ids.push(loc._id || loc));
    }
    return [...new Set(ids.filter(Boolean))];
  };

  const usesAllAssignedBranches = (userData) => (
    userData?.role === 'branch_admin' && getUserBranchIds(userData).length > 1
  );

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

  const fetchCafes = async () => {
    try {
      const res = await api.get('/cafes');
      setCafes(res.data.data || []);
      return res.data.data || [];
    } catch (err) {
      logger.error('Failed to load cafes');
      return [];
    }
  };

  const initializeSocket = (userData, locationOverride = null) => {
    if (!userData) return;
    
    // Disconnect existing socket if any
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socketUrl = getSocketUrl();
    if (!socketUrl) return;

    const newSocket = io(socketUrl, { withCredentials: true });
    newSocket.on('connect', () => {
      const activeLocation = locationOverride || selectedLocation;
      const branchId = activeLocation?._id || activeLocation || (usesAllAssignedBranches(userData) ? 'all' : (userData.assignedLocation?._id || userData.assignedLocation));
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
      location_admin: '/dashboard/location-admin',
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
            setSelectedLocation(initialLocation === 'all' ? null : initialLocation);
          } catch (e) {
            logger.error('Invalid stored location');
          }
        } else if (['admin', 'super_admin'].includes(userData.role) || usesAllAssignedBranches(userData)) {
          initialLocation = null;
          setSelectedLocation(null);
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

  // Mirror every auth transition (initial load, login, logout, impersonation)
  // onto the global top progress bar for instant visual feedback.
  useEffect(() => {
    if (loading) progress.start();
    else progress.done(true);
  }, [loading]);

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
    const nextLocation = location === 'all' ? null : location;
    setSelectedLocation(nextLocation);
    setSelectedLocationIds([]); // single-select clears multi-select

    if (nextLocation) {
      Cookies.set('selectedLocation', JSON.stringify(nextLocation), { expires: 30 });
    } else {
      Cookies.remove('selectedLocation');
    }

    if (socketRef.current && user) {
      socketRef.current.emit('join_session', { branchId: nextLocation?._id || nextLocation || 'all' });
    }
  };

  // Set a subset of branch IDs to filter by (multi-branch mode)
  const switchLocationIds = (ids) => {
    if (!ids || ids.length === 0) {
      setSelectedLocationIds([]);
      setSelectedLocation(null);
      Cookies.remove('selectedLocation');
      if (socketRef.current && user) {
        socketRef.current.emit('join_session', { branchId: 'all' });
      }
    } else if (ids.length === 1) {
      // Single selection — fall through to normal single-location mode
      const loc = locations.find(l => (l._id || l) === ids[0]) || ids[0];
      switchLocation(loc);
    } else {
      setSelectedLocationIds(ids);
      setSelectedLocation(null); // null = custom subset (not "all")
      Cookies.remove('selectedLocation');
    }
  };

  // Tracks the cafe whose branch scope has actually been applied, so the back-fill
  // effect below applies it exactly once per cafe and never clobbers a manual
  // branch narrowing on a later locations refetch.
  const appliedCafeScopeRef = useRef(null);

  // Switch the active cafe. 'all' = every cafe (all branches). Selecting a
  // specific cafe scopes the branch selector + data to that cafe's branches
  // (all of them by default; the branch panel can then narrow to one).
  const switchCafe = (cafeId) => {
    const next = cafeId || 'all';
    setSelectedCafe(next);
    if (next === 'all') {
      Cookies.remove('selectedCafe');
      appliedCafeScopeRef.current = null;
      switchLocationIds([]); // all branches across all cafes
      return;
    }
    Cookies.set('selectedCafe', next, { expires: 30 });
    // Apply the cafe's branch scope now IF locations are loaded; otherwise defer to
    // the effect below. Previously this computed from a possibly-empty `locations`
    // and silently reset to "all branches" when a cafe was chosen/restored before
    // the locations list had loaded.
    if (locations && locations.length > 0) {
      const cafeBranchIds = locations
        .filter((l) => String(l.cafe?._id || l.cafe) === String(next))
        .map((l) => l._id || l);
      appliedCafeScopeRef.current = next;
      switchLocationIds(cafeBranchIds); // all branches of this cafe
    } else {
      appliedCafeScopeRef.current = null; // pending — back-filled once locations load
    }
  };

  // Back-fill the selected cafe's branch scope once locations are available. Covers
  // both restore-on-reload (the cookie is restored before locations load) and
  // choosing a cafe early. The ref guard makes it run once per cafe (no loop, and a
  // user's later manual branch narrowing is preserved).
  useEffect(() => {
    if (!selectedCafe || selectedCafe === 'all') return;
    if (!locations || locations.length === 0) return;
    if (appliedCafeScopeRef.current === selectedCafe) return;
    const cafeBranchIds = locations
      .filter((l) => String(l.cafe?._id || l.cafe) === String(selectedCafe))
      .map((l) => l._id || l);
    appliedCafeScopeRef.current = selectedCafe;
    switchLocationIds(cafeBranchIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, selectedCafe]);

  // Load cafes whenever a session is established; restore the saved cafe filter.
  useEffect(() => {
    if (!user) { setCafes([]); setSelectedCafe('all'); return; }
    const stored = Cookies.get('selectedCafe');
    if (stored) setSelectedCafe(stored);
    fetchCafes();
  }, [user]);

  const login = async (email, password) => {
    try {
      setLoading(true);
      const res = await api.post('/auth/login', { email, password });
      const userData = res.data.data;
      setUser(userData);
      // Do NOT store full user object in readable cookie (XSS risk).
      // In-memory state + server httpOnly JWT cookie is sufficient.

      const initialLoc = ['admin', 'super_admin'].includes(userData.role) || usesAllAssignedBranches(userData)
        ? null
        : userData.assignedLocation || (userData.accessibleLocations?.length > 0 ? userData.accessibleLocations[0] : null);
      if (initialLoc) {
        setSelectedLocation(initialLoc);
        Cookies.set('selectedLocation', JSON.stringify(initialLoc), { expires: 30 });
      } else {
        setSelectedLocation(null);
        Cookies.remove('selectedLocation');
      }

      initializeSocket(userData, initialLoc);
      await fetchLocations();
      toast.success(`Welcome back, ${userData.name}`);
      setLoading(false);
      router.push(getRoleDashboard(userData.role));

      return { success: true };
    } catch (error) {
      setLoading(false);
      const message = error.response?.data?.message ||
        (error.request
          ? 'Could not connect to the server. Please check your internet and try again.'
          : 'Login failed. Please try again.');

      return {
        success: false,
        message
      };
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await api.post('/auth/logout');
    } catch (err) {
      logger.error('Backend logout failed');
    }
    
    Cookies.remove('selectedLocation');
    Cookies.remove('selectedCafe');

    setUser(null);
    setSelectedLocation(null);
    setSelectedCafe('all');
    setCafes([]);
    setLocations([]);
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
      await api.post(`/auth/impersonate/${userId}`, { viewOnly });
      // Read the authoritative profile after the cookie switches. This includes
      // impersonatedBy/isViewOnly immediately, so the exit banner renders
      // without requiring a manual page refresh.
      const profile = await api.get('/auth/profile');
      const userData = profile.data.data;
      setUser(userData);

      const initialLoc = ['admin', 'super_admin'].includes(userData.role) || usesAllAssignedBranches(userData)
        ? null
        : userData.assignedLocation || (userData.accessibleLocations?.length > 0 ? userData.accessibleLocations[0] : null);
      if (initialLoc) {
        setSelectedLocation(initialLoc);
        Cookies.set('selectedLocation', JSON.stringify(initialLoc), { expires: 30 });
      } else {
        setSelectedLocation(null);
        Cookies.remove('selectedLocation');
      }

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      initializeSocket(userData, initialLoc);
      await fetchLocations();
      setLoading(false);
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
      await api.post('/auth/exit-impersonation');
      const profile = await api.get('/auth/profile');
      const userData = profile.data.data;
      setUser(userData);

      const initialLoc = ['admin', 'super_admin'].includes(userData.role) || usesAllAssignedBranches(userData)
        ? null
        : userData.assignedLocation || (userData.accessibleLocations?.length > 0 ? userData.accessibleLocations[0] : null);
      if (initialLoc) {
        setSelectedLocation(initialLoc);
        Cookies.set('selectedLocation', JSON.stringify(initialLoc), { expires: 30 });
      } else {
        setSelectedLocation(null);
        Cookies.remove('selectedLocation');
      }

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      initializeSocket(userData, initialLoc);
      await fetchLocations();
      setLoading(false);
      // Role-routed home — a non-admin delegated impersonator can't open
      // /dashboard/admin/users and would be bounced by the layout guard.
      router.replace(getRoleDashboard(userData.role));

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
      selectedLocationIds,
      switchLocation,
      switchLocationIds,
      locations,
      refreshLocations: fetchLocations,
      cafes,
      selectedCafe,
      switchCafe,
      refreshCafes: fetchCafes,
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
