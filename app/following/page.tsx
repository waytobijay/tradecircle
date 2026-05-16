/**
 * app/following/page.tsx
 * Server wrapper — forces dynamic rendering so the client component
 * (which reads Firebase via onSnapshot) is never prerendered at build time.
 */

import FollowingClient from './Client';

export const dynamic = 'force-dynamic';

export default function FollowingPage() {
  return <FollowingClient />;
}
