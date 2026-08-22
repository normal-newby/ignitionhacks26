import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';

/**
 * Gate for everything that needs an account. Wraps routes as a layout element, so a page
 * behind it can assume `useAuth().user` is set and never has to branch on being signed out.
 *
 * Where the user came from rides along in `state.from`, so signing in lands them back on the
 * room they clicked rather than on the grid.
 */
export default function RequireAuth() {
  const { user, checking } = useAuth();
  const location = useLocation();

  // Nothing at all while the stored session is being confirmed: a spinner is honest here,
  // and bouncing to /login first would send a signed-in user through the login screen on
  // every hard reload.
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-[#3b82f6]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
