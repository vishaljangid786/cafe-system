'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Bell, LogOut, User as UserIcon, Sun, Moon, 
  Menu, X, Search, MapPin, ChevronDown, Check,
  Globe
} from 'lucide-react';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const Navbar = ({ onToggleSidebar, sidebarExpanded, isMobile }) => {
  const { user, selectedLocation, switchLocation, logout, socket } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [allLocations, setAllLocations] = useState([]);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        const res = await api.get('/notifications?limit=5');
        setNotifications(res.data.data);
        const countRes = await api.get('/notifications/unread-count');
        setUnreadCount(countRes.data.count);
      } catch (err) {}
    };

    const fetchAllLocations = async () => {
      if (user.role === 'super_admin' || user.role === 'admin') {
        try {
          const res = await api.get('/locations');
          setAllLocations(res.data.data);
        } catch (err) {}
      }
    };

    fetchNotifications();
    fetchAllLocations();

    if (socket) {
      socket.on('new_notification', (notification) => {
        setNotifications(prev => [notification, ...prev].slice(0, 5));
        setUnreadCount(prev => prev + 1);
      });

      socket.on('booking_status_updated', (data) => {
        if (data.status === 'confirmed') {
          toast.success(data.message, { duration: 5000 });
        } else {
          toast.error(data.message, { duration: 5000 });
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('new_notification');
        socket.off('booking_status_updated');
      }
    }
  }, [user, socket]);

  if (!user) return null;

  // Determine available locations for the switcher
  const accessibleLocations = user.role === 'super_admin' || user.role === 'admin' 
    ? allLocations 
    : (user.assignedLocation ? [user.assignedLocation] : []);

  const currentLocationLabel = selectedLocation 
    ? `${selectedLocation.city} - ${selectedLocation.name}`
    : 'Global Network';

  return (
    <header className="h-20 flex items-center justify-between px-6 bg-background/80 backdrop-blur-md border-b border-border z-[90] sticky top-0">
      <div className="flex items-center gap-4">
        <button 
          onClick={onToggleSidebar}
          className="p-2.5 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-xl transition-all duration-300"
        >
          <Menu size={20} />
        </button>
        
        <div className="hidden md:flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-sm font-black uppercase tracking-widest text-muted-foreground/60">
            {user.role.replace('_', ' ')} Portal
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center relative mr-4">
          <Search className="absolute left-4 text-muted-foreground" size={16} />
          <input 
            type="text" 
            placeholder="Search matrix..." 
            className="pl-11 pr-4 py-2.5 bg-muted/50 border border-border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 w-64 transition-all"
          />
        </div>

        {/* Location Switcher */}
        <div className="relative">
          <button 
            onClick={() => setShowLocationSelector(!showLocationSelector)}
            className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 hover:bg-accent/10 hover:text-accent border border-border rounded-2xl transition-all duration-300 group"
          >
            <MapPin size={16} className="text-accent" />
            <span className="text-xs font-black tracking-tight max-w-[120px] truncate">{currentLocationLabel}</span>
            <ChevronDown size={14} className={`transition-transform duration-300 ${showLocationSelector ? 'rotate-180' : ''}`} />
          </button>
          
          <AnimatePresence>
            {showLocationSelector && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-64 glass-card rounded-2xl overflow-hidden shadow-2xl z-[100] p-2"
              >
                <div className="space-y-1">
                  <p className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50 flex items-center gap-2">
                    <Globe size={10} /> Accessible Nodes
                  </p>
                  
                  {accessibleLocations.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-muted-foreground text-center italic">No accessible nodes found</div>
                  ) : (
                    accessibleLocations.map((loc) => {
                      const isSelected = selectedLocation?._id === loc._id;
                      return (
                        <button 
                          key={loc._id}
                          onClick={() => {
                            switchLocation(loc);
                            setShowLocationSelector(false);
                          }}
                          className={`
                            flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-xs transition-all duration-200
                            ${isSelected 
                              ? 'bg-accent/10 text-accent font-bold' 
                              : 'hover:bg-muted text-muted-foreground hover:text-foreground'}
                          `}
                        >
                          <div className="flex flex-col items-start min-w-0">
                            <span className="truncate w-full text-left">{loc.city}</span>
                            <span className={`text-[9px] uppercase tracking-tighter opacity-60 ${isSelected ? '' : 'text-muted-foreground'}`}>{loc.name}</span>
                          </div>
                          {isSelected && <Check size={14} />}
                        </button>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center bg-muted/30 p-1.5 rounded-2xl border border-border ml-2">
          <button 
            onClick={toggleTheme}
            className="p-2 text-muted-foreground hover:text-accent transition-colors"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-muted-foreground hover:text-accent relative transition-colors"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-accent rounded-full ring-2 ring-background" />
            )}
          </button>
        </div>

        <div className="ml-2 flex items-center gap-3 pl-3 border-l border-border">
           <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-black tracking-tight">{user.name}</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Status: Active</span>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent relative">
            <UserIcon size={20} />
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-background" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
