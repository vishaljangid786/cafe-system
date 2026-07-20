'use client';
import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { buildNavGroups } from '../config/navigation';

// Single source of truth for the navigation the CURRENT user may reach — the
// exact same access rules the sidebar renders. Returns grouped nav items; the
// command palette flattens this so it can never show a page the user can't open.
// The pure logic lives in config/navigation.js so non-hook callers (AuthContext
// redirects, the layout guard) can share it.
export default function useNavGroups() {
  const { user, locations = [] } = useAuth();
  const { unreadCount } = useNotifications();

  return useMemo(
    () => buildNavGroups(user, { locations, unreadCount }),
    [user, unreadCount, locations]
  );
}
