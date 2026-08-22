import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import Landing from './Landing';

/**
 * What `/` resolves to. Signed out, it's the pitch; signed in, it's a redirect to the room
 * grid — somebody with an account clicking the logo wants their rooms, not to be sold the
 * product again.
 *
 * It waits out the session check rather than rendering the landing page first, because a
 * flash of "create an account" at somebody who has one reads as being logged out.
 */
export default function LandingOrRooms() {
  const { user, checking } = useAuth();

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-[#3b82f6]" />
      </div>
    );
  }

  return user ? <Navigate to="/rooms" replace /> : <Landing />;
}
