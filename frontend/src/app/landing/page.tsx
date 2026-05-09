import { redirect } from 'next/navigation';

/** Legacy path; landing content lives at `/`. */
export default function LandingRedirectPage() {
  redirect('/');
}
