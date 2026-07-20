'use client';
import StaffTeamPage from '../../admin/staff/page';

// The server scopes GET /users to this branch admin's own branch, so the
// unified People page renders only their staff. Creating members goes through
// /dashboard/add-member (the inline quick-create modal is retired).
export default function BranchStaffPage() {
  return <StaffTeamPage />;
}
