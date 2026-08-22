import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Boxes, LogOut } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';

/**
 * Shell for the signed-in pages. Only ever rendered inside RequireAuth, so `user` is always
 * set here and the account chip needs no fallback.
 *
 * The `backdrop-blur` this header used to carry is gone: nothing behind it scrolls under
 * translucency worth blurring, and the app's depth comes from hard borders and offset shadows
 * rather than from glass.
 */
export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    navigate('/', { replace: true });
  };

  const navClass = ({ isActive }) =>
    `px-3 py-1.5 font-terminal text-base uppercase border-2 transition-colors ${
      isActive
        ? 'bg-[#3b82f6] text-white border-[#1e40af]'
        : 'text-[#252525] border-transparent hover:border-[#1e40af]'
    }`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b-2 border-[#1e40af] bg-[#e2e8f0] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/rooms" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 bg-[#3b82f6] border-2 border-[#1e40af] flex items-center justify-center">
              <Boxes className="w-4 h-4 text-white" />
            </div>
            <span className="font-heading text-sm text-[#252525] hidden sm:inline">REFURNISH</span>
          </Link>

          <nav className="flex items-center gap-1">
            <NavLink to="/rooms" className={navClass}>Rooms</NavLink>
            <NavLink to="/catalog" className={navClass}>Catalog</NavLink>
          </nav>

          <div className="flex items-center gap-2 min-w-0">
            {/* The name is the only place the account is visible, so it doesn't get truncated
                away on narrow screens — it's hidden outright instead. */}
            <span className="hidden md:block font-mono text-xs text-[#5a6c80] truncate max-w-[10rem]">
              {user.display_name || user.username}
            </span>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#e2e8f0] text-[#252525] font-terminal text-base uppercase border-2 border-[#1e40af] hover:bg-[#cbd5e1] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
