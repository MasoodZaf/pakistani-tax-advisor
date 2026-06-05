import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { getToken, storeToken, clearToken } from '../utils/tokenStorage';

// Set axios defaults for API base URL
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Decode JWT payload without verification (client-side display only)
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null);
  const [sessionWarning, setSessionWarning] = useState(false); // true = <5 min left
  // Pre-loaded data from the login API response — used to seed the dashboard instantly
  const [loginPayload, setLoginPayload] = useState(null);

  const warningTimerRef = useRef(null);
  const expiryTimerRef = useRef(null);

  const clearExpiryTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    warningTimerRef.current = null;
    expiryTimerRef.current = null;
    setSessionWarning(false);
    setSessionExpiresAt(null);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    // Impersonation keys (legacy admin-assisted flow).
    localStorage.removeItem('adminAssistedLogin');
    localStorage.removeItem('isImpersonation');
    localStorage.removeItem('impersonatedBy');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('user');
    // Legacy prior-year sessionStorage keys (replaced by /tax-history archive).
    sessionStorage.removeItem('priorYearData');
    sessionStorage.removeItem('priorYearWarnings');
    sessionStorage.removeItem('priorYearDismissed');
    setUser(null);
    setLoginPayload(null);
    clearExpiryTimers();
    toast.success('Logged out successfully');
  }, [clearExpiryTimers]);

  // Schedule warning toast and auto-logout based on JWT exp claim
  const scheduleExpiryWarning = useCallback((token) => {
    clearExpiryTimers();

    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return;

    const expiresAt = payload.exp * 1000; // convert to ms
    const now = Date.now();
    const msUntilExpiry = expiresAt - now;

    if (msUntilExpiry <= 0) {
      // Already expired
      logout();
      return;
    }

    setSessionExpiresAt(new Date(expiresAt));

    const WARN_BEFORE_MS = 5 * 60 * 1000; // 5 minutes
    const msUntilWarning = msUntilExpiry - WARN_BEFORE_MS;

    if (msUntilWarning > 0) {
      warningTimerRef.current = setTimeout(() => {
        setSessionWarning(true);
        toast(
          '⏰ Your session expires in 5 minutes. Save your work.',
          { duration: 10000, icon: '⚠️' }
        );
      }, msUntilWarning);
    } else {
      // Less than 5 min remaining on restore — warn immediately
      setSessionWarning(true);
    }

    // Auto-logout at expiry
    expiryTimerRef.current = setTimeout(() => {
      setUser(null);
      clearToken();
      clearExpiryTimers();
      toast.error('Your session has expired. Please log in again.');
    }, msUntilExpiry);
  }, [clearExpiryTimers, logout]);

  // Set up axios interceptors
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const token = getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (
          error.response?.status === 401 &&
          !error.config?.url?.includes('/login') &&
          !error.config?.url?.includes('/register') &&
          getToken() // only act if there was an active session
        ) {
          clearToken();
          setUser(null);
          clearExpiryTimers();
          toast.error('Session expired. Please login again.');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [clearExpiryTimers]);

  // Restore session on app start
  useEffect(() => {
    checkAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => clearExpiryTimers();
  }, [clearExpiryTimers]);

  const checkAuthStatus = () => {
    try {
      const token = getToken();
      if (!token) return;

      const payload = decodeJwtPayload(token);
      if (!payload) {
        clearToken();
        return;
      }

      // Reject already-expired tokens
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        clearToken();
        return;
      }

      // JWT is valid — restore user from payload for an instant first paint.
      setUser({
        id: payload.userId,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        onboarding_completed: payload.onboarding_completed !== false,
      });
      scheduleExpiryWarning(token);

      // FE-05: the payload above is only base64-decoded, not signature-verified,
      // so its `role` is not authoritative for UI gating. Confirm it against the
      // server (which re-reads the DB row) and correct it if it differs; a bad/
      // tampered token 401s here and the response interceptor logs out.
      axios.get('/api/me')
        .then((r) => {
          const u = r.data?.user;
          if (u) setUser((prev) => (prev ? { ...prev, role: u.role, email: u.email, name: u.name } : prev));
        })
        .catch(() => { /* 401 handled by the response interceptor */ });
    } catch {
      clearToken();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, adminBypassToken = null, rememberMe = true) => {
    try {
      const loginPayload = { email, password };
      if (adminBypassToken) loginPayload.adminBypassToken = adminBypassToken;

      const response = await axios.post('/api/login', loginPayload);

      if (response.data?.success) {
        const { token, user: userData, hasPersonalInfo, currentYearData, taxYearsSummary } = response.data;

        // "Remember me": persist to localStorage (survives restart) or, when
        // unchecked, sessionStorage (cleared when the browser closes).
        storeToken(token, rememberMe);
        // Treat undefined as "completed" so legacy logins (pre-flag) don't get
        // bounced into the wizard.
        setUser({ ...userData, onboarding_completed: userData.onboarding_completed !== false });
        scheduleExpiryWarning(token);

        // Store pre-loaded data so the Dashboard can render immediately without a second fetch
        if (!['admin', 'super_admin'].includes(userData.role)) {
          setLoginPayload({ currentYearData: currentYearData || null, taxYearsSummary: taxYearsSummary || [] });
        }

        toast.success(`Welcome back, ${userData.name}!`);

        if (!['admin', 'super_admin'].includes(userData.role)) {
          return { success: true, needsPersonalInfo: !hasPersonalInfo, userData };
        }
        return { success: true, userData };
      } else {
        const message = response.data?.error || 'Login failed';
        toast.error(message);
        return { success: false, error: message };
      }
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Login failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // SSO bridge: client (here, the Google button) hands us an idToken from
  // the OAuth round-trip; backend verifies it, returns the same { token, user }
  // shape /api/login uses. Coexists with password login.
  //
  // `nonce` is the random value the client generated and handed to the
  // provider before the OAuth round-trip. The backend re-checks that the
  // ID token's `nonce` claim matches — this binds the token to this
  // sign-in attempt and is the defense against ID-token replay.
  const ssoLogin = async (provider, idToken, nonce) => {
    try {
      const response = await axios.post(`/api/sso/${provider}`, { idToken, nonce });
      if (!response.data?.success) {
        const message = response.data?.error || 'SSO sign-in failed';
        toast.error(message);
        return { success: false, error: message };
      }
      const { token, user: userData } = response.data;
      storeToken(token); // keep whatever storage the session is already using
      setUser({ ...userData, onboarding_completed: userData.onboarding_completed !== false });
      scheduleExpiryWarning(token);
      toast.success(`Welcome, ${userData.name || userData.email}!`);
      // The SSO endpoint doesn't fetch hasPersonalInfo / taxYearsSummary —
      // dashboard/onboarding routes will fetch on mount.
      return { success: true, needsPersonalInfo: !userData.onboarding_completed, userData };
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'SSO sign-in failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post('/api/register', userData);
      const { token, user: newUser } = response.data;
      storeToken(token);
      // Backend returns onboarding_completed: false for fresh registrations.
      // The Onboarding wizard relies on this flag to keep the user inside the
      // flow until they hit "Done" — see App.js OnboardingRoute.
      setUser({ ...newUser, onboarding_completed: !!newUser.onboarding_completed });
      if (token) scheduleExpiryWarning(token);
      toast.success(`Welcome, ${newUser.name}!`);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // Called from the onboarding wizard's final step. Persists the flag, swaps
  // the JWT, and updates the user state so route guards stop enforcing the
  // wizard.
  const completeOnboarding = async () => {
    try {
      const response = await axios.post('/api/onboarding/complete');
      const { token, user: updated } = response.data;
      if (token) {
        storeToken(token); // preserve the session's current storage choice
        scheduleExpiryWarning(token);
      }
      setUser((prev) => ({ ...(prev || {}), ...updated, onboarding_completed: true }));
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to finish onboarding';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const updateUser = (userData) => {
    setUser(prev => ({ ...prev, ...userData }));
  };

  const clearLoginPayload = () => setLoginPayload(null);

  const value = {
    user,
    loading,
    login,
    ssoLogin,
    register,
    completeOnboarding,
    logout,
    updateUser,
    checkAuthStatus,
    sessionExpiresAt,
    sessionWarning,
    loginPayload,       // { currentYearData, taxYearsSummary } — available immediately after login
    clearLoginPayload,  // call once TaxFormContext has loaded its own data
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
