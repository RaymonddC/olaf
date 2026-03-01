import { redirect } from 'next/navigation';

/**
 * Root landing page — redirects to login.
 * Auth-aware redirect (to /talk or /dashboard) is handled in the login page
 * after Firebase auth state resolves.
 */
export default function RootPage() {
  redirect('/login');
}
