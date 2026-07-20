'use client';
import StaffTeamPage from '../staff/page';

// Users and Staff were two near-duplicate people pages; both nav items now open
// the unified People page (list + tree, filters, block/unblock, role/branch
// reassignment, per-row permission editing).
export default function AdminUsersPage() {
  return <StaffTeamPage />;
}
