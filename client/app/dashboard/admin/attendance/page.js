'use client';
import PeopleHub from '@/app/components/people/PeopleHub';

// Attendance now lives in components/people/AttendanceSection (a tab of the
// People hub). Branch/location-admin attendance routes re-export this page.
export default function GlobalAttendancePage() {
  return <PeopleHub defaultTab="attendance" />;
}
