'use client';
import StaffTeamPage from '../../admin/staff/page';

// The server scopes GET /users to this location admin's branch; the unified
// People page replaces the old unpaginated card grid.
export default function LocationStaffPage() {
  return <StaffTeamPage />;
}
