import { getToken, storeToken, clearToken, TOKEN_KEY } from './tokenStorage';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('tokenStorage — "Remember me" persistence', () => {
  test('remember=true persists to localStorage and clears sessionStorage', () => {
    sessionStorage.setItem(TOKEN_KEY, 'stale'); // pretend a prior no-remember session
    storeToken('tok-A', true);
    expect(localStorage.getItem(TOKEN_KEY)).toBe('tok-A');
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(getToken()).toBe('tok-A');
  });

  test('remember=false persists to sessionStorage and clears localStorage', () => {
    localStorage.setItem(TOKEN_KEY, 'stale'); // pretend a prior remembered session
    storeToken('tok-B', false);
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe('tok-B');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(getToken()).toBe('tok-B');
  });

  test('getToken prefers localStorage but falls back to sessionStorage', () => {
    sessionStorage.setItem(TOKEN_KEY, 'sess');
    expect(getToken()).toBe('sess');
    localStorage.setItem(TOKEN_KEY, 'local');
    expect(getToken()).toBe('local');
  });

  test('remember=undefined keeps a session-only token in sessionStorage (token swap)', () => {
    storeToken('tok-C', false); // no-remember login
    storeToken('tok-C2'); // e.g. onboarding-complete swaps the token
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe('tok-C2');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  test('remember=undefined keeps a remembered token in localStorage (token swap)', () => {
    storeToken('tok-D', true); // remembered login
    storeToken('tok-D2'); // token swap
    expect(localStorage.getItem(TOKEN_KEY)).toBe('tok-D2');
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  test('remember=undefined with no existing token defaults to localStorage (SSO/register)', () => {
    storeToken('tok-E'); // fresh SSO/register, nothing stored yet
    expect(localStorage.getItem(TOKEN_KEY)).toBe('tok-E');
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  test('clearToken removes from both storages', () => {
    localStorage.setItem(TOKEN_KEY, 'x');
    sessionStorage.setItem(TOKEN_KEY, 'y');
    clearToken();
    expect(getToken()).toBeNull();
  });
});
