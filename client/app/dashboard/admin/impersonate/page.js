'use client';
import PeopleHub from '@/app/components/people/PeopleHub';

// Login-As (impersonate) now lives in components/people/LoginAsSection, a tab
// of the People hub.
export default function ImpersonatePage() {
  return <PeopleHub defaultTab="login-as" />;
}
