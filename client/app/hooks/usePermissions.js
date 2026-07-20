'use client';
import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { can } from '../config/actions';
import { canViewPage } from '../config/pages';

// Thin hooks over the existing predicates so pages stop threading `user` by hand.
//
//   const canDo = useCan();
//   {canDo('expenses.approve') && <ApproveButton />}
//
//   const canPage = useCanPage();
//   {canPage('page_permissions') && <PermissionsLink />}

export function useCan() {
  const { user } = useAuth();
  return useCallback((actionKey) => can(user, actionKey), [user]);
}

export function useCanPage() {
  const { user } = useAuth();
  return useCallback((pageKey) => canViewPage(user, pageKey), [user]);
}
