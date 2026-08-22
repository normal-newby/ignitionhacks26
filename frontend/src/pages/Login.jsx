import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Boxes, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';

/**
 * Sign in and sign up, one form and one toggle.
 *
 * They're the same screen because they're the same three fields and the same destination, and
 * because a wrong guess about which one you wanted shouldn't cost a page load — the toggle
 * keeps whatever you've already typed.
 *
 * `?mode=register` opens on the sign-up side, which is what the landing page's "Create
 * account" buttons link to.
 */
export default function Login() {
  const [params] = useSearchParams();
  const [registering, setRegistering] = useState(params.get('mode') === 'register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Where RequireAuth bounced them from, so signing in lands on the room they clicked.
  const destination = location.state?.from?.pathname || '/rooms';

  if (user) {
    return <Navigate to={destination} replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError('');
    try {
      if (registering) {
        await signUp({ username, password, displayName });
      } else {
        await signIn({ username, password });
      }
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const toggle = () => {
    setRegistering((current) => !current);
    setError('');
  };

  const field =
    'w-full px-3 py-2.5 bg-[#e2e8f0] border-2 border-[#1e40af] font-mono text-sm ' +
    'text-[#252525] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] disabled:opacity-60';
  const fieldLabel = 'block font-heading text-[9px] uppercase text-[#1e40af] mb-1.5';

  return (
    <div className="min-h-screen bg-background flex flex-col animate-fade-in">
      <div className="px-6 py-5">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 font-terminal text-base uppercase text-[#5a6c80] hover:text-[#252525] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      <div className="flex-1 flex items-start justify-center px-6 pb-20 pt-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 bg-[#3b82f6] border-2 border-[#1e40af] flex items-center justify-center">
              <Boxes className="w-4 h-4 text-white" />
            </div>
            <span className="font-heading text-sm text-[#252525]">REFURNISH</span>
          </div>

          <h1 className="font-heading text-xs uppercase text-[#252525] leading-relaxed mb-2">
            {registering ? 'Create an account' : 'Sign in'}
          </h1>
          <p className="font-mono text-xs text-[#5a6c80] mb-7">
            {registering
              ? 'Your rooms and your uploads are kept under this account.'
              : 'Pick up where you left off.'}
          </p>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 p-3 border-2 border-[#ef4444] bg-[#ef4444]/10">
              <AlertCircle className="w-4 h-4 text-[#ef4444] flex-shrink-0 mt-0.5" />
              <p className="font-mono text-xs text-[#ef4444]">{error}</p>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="username" className={fieldLabel}>Username</label>
              <input
                id="username"
                type="text"
                value={username}
                disabled={busy}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                onChange={(e) => setUsername(e.target.value)}
                className={field}
              />
            </div>

            {registering && (
              <div>
                <label htmlFor="display-name" className={fieldLabel}>
                  Display name <span className="text-[#5a6c80]">(optional)</span>
                </label>
                <input
                  id="display-name"
                  type="text"
                  value={displayName}
                  disabled={busy}
                  autoComplete="nickname"
                  placeholder="Defaults to your username"
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={field}
                />
              </div>
            )}

            <div>
              <label htmlFor="password" className={fieldLabel}>Password</label>
              <input
                id="password"
                type="password"
                value={password}
                disabled={busy}
                autoComplete={registering ? 'new-password' : 'current-password'}
                onChange={(e) => setPassword(e.target.value)}
                className={field}
              />
              {registering && (
                <p className="font-mono text-[10px] text-[#5a6c80] mt-1.5">
                  At least 6 characters.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={busy || !username || !password}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#3b82f6] text-white font-terminal text-lg uppercase border-2 border-[#1e40af] shadow-[3px_3px_0px_#1e40af] hover:shadow-[1px_1px_0px_#1e40af] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-shadow disabled:opacity-40 disabled:shadow-[3px_3px_0px_#1e40af] disabled:translate-x-0 disabled:translate-y-0"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {registering ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t-2 border-[#cbd5e1] text-center">
            <p className="font-mono text-xs text-[#5a6c80]">
              {registering ? 'Already have an account?' : "Don't have an account?"}
            </p>
            <button
              type="button"
              onClick={toggle}
              disabled={busy}
              className="mt-2 font-terminal text-base uppercase text-[#3b82f6] underline underline-offset-4 hover:text-[#1e40af] transition-colors disabled:opacity-50"
            >
              {registering ? 'Sign in instead' : 'Create one'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
