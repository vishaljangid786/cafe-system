'use client';
import PeopleHub from '@/app/components/people/PeopleHub';

// The staff directory lives in components/people/TeamDirectory (a tab of the
// People hub). Branch/location-admin staff routes re-export this page, so
// they get the hub too — the server still scopes GET /users per requester.
export default function StaffTeamPage() {
  return <PeopleHub defaultTab="team" />;
}
