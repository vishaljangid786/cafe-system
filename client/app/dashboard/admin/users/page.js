'use client';
import PeopleHub from '@/app/components/people/PeopleHub';

// Users, Staff, Attendance and Login-As are one unified People hub now; this
// route (and each of the others) just picks the tab it historically showed.
export default function AdminUsersPage() {
  return <PeopleHub defaultTab="team" />;
}
