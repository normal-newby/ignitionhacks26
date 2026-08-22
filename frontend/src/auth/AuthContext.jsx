import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchCurrentUser, login as apiLogin, register as apiRegister } from '@/api/auth';
import { clearSession, readSession, writeSession, SIGNED_OUT_EVENT } from '@/api/session';

const AuthContext = createContext(null);

/**
 * Holds the signed-in account for the app.
 *
 * The initial value is read from localStorage synchronously, so a reload doesn't flash the
 * login screen on the way to a page the user is already entitled to. `checking` covers the
 * round trip that confirms the stored id still resolves server-side — a session can outlive
 * the account it names (a wiped database, mostly), and rendering the app around a user who
 * isn't there produces a page of 401s instead of one redirect.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession);
  const [checking, setChecking] = useState(() => readSession() !== null);

  useEffect(() => {
    if (!checking) return;
    let cancelled = false;

    fetchCurrentUser()
      .then((confirmed) => {
        if (cancelled) return;
        if (confirmed) {
          // Re-store it: a display name changed elsewhere should win over the stale copy.
          writeSession(confirmed);
          setUser(confirmed);
        } else {
          clearSession();
          setUser(null);
        }
      })
      .finally(() => !cancelled && setChecking(false));

    return () => { cancelled = true; };
    // Runs once: `checking` only ever goes true -> false, and re-running on that would
    // re-check a session we just finished checking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The api modules clear the session themselves on a 401 and announce it here, since they
  // can't route anywhere from outside React. See api/session.js.
  useEffect(() => {
    const onSignedOut = () => setUser(null);
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
  }, []);

  const adopt = useCallback((account) => {
    writeSession(account);
    setUser(account);
    return account;
  }, []);

  const signIn = useCallback(
    (credentials) => apiLogin(credentials).then(adopt),
    [adopt]
  );

  // Registering signs you straight in — there's nothing to verify and no email to confirm.
  const signUp = useCallback(
    (details) => apiRegister(details).then(adopt),
    [adopt]
  );

  const signOut = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, checking, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
