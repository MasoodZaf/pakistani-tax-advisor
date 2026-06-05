// Auth token persistence — backs the login "Remember me" choice.
//
//   remember === true   → localStorage   (survives a browser restart)
//   remember === false  → sessionStorage (cleared when the tab/browser closes)
//   remember === undefined → keep the token in whichever storage it already
//     lives in (used for token *swaps* — onboarding-complete, register — so a
//     no-remember session is never silently upgraded to persistent).
//
// All access goes through these helpers so the two storages never diverge.

export const TOKEN_KEY = 'token';

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const storeToken = (token, remember) => {
  try {
    const inSessionOnly =
      sessionStorage.getItem(TOKEN_KEY) != null && localStorage.getItem(TOKEN_KEY) == null;
    const useLocal = remember === undefined ? !inSessionOnly : !!remember;
    if (useLocal) {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* storage unavailable (private mode) — request interceptor just won't attach a token */
  }
};

export const clearToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
};
