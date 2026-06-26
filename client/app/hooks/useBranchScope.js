'use client';
import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Single source of truth for the active branch/cafe filter.
 *
 * The Navbar's global Cafe + Branch selectors (stored in AuthContext) are the
 * ONLY place a user picks scope. Pages must NOT render their own branch/cafe
 * dropdowns — they read the active scope from this hook instead.
 *
 * Navbar selection collapses to one of three shapes:
 *   - All branches      -> selectedLocation = null, selectedLocationIds = []
 *   - One branch        -> selectedLocation = {branch}, selectedLocationIds = []
 *   - A subset (>=2)    -> selectedLocation = null, selectedLocationIds = [ids]
 *     (Choosing a cafe expands to that cafe's branch ids via selectedLocationIds.)
 *
 * Returns helpers so each page can map the scope onto whatever query param its
 * API expects (branchId / locationId single, or branchIds / locationIds plural).
 */
export default function useBranchScope() {
  const { selectedLocation, selectedLocationIds, selectedCafe } = useAuth();

  return useMemo(() => {
    let branchIds = [];
    if (Array.isArray(selectedLocationIds) && selectedLocationIds.length > 0) {
      branchIds = selectedLocationIds;
    } else if (selectedLocation) {
      branchIds = [selectedLocation._id || selectedLocation];
    }

    const isAll = branchIds.length === 0;
    // A single id when exactly one branch is in scope; otherwise 'all'
    // (back-ends that only accept one branch fall back to 'all' for subsets).
    const singleBranchId = branchIds.length === 1 ? branchIds[0] : 'all';
    const cafeId = selectedCafe && selectedCafe !== 'all' ? selectedCafe : null;

    // Re-render/refetch key — put this in effect deps to refetch on scope change.
    const scopeKey = `${branchIds.join(',')}|${cafeId || ''}`;

    return { branchIds, singleBranchId, isAll, cafeId, scopeKey };
  }, [selectedLocation, selectedLocationIds, selectedCafe]);
}
