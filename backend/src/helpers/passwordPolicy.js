/**
 * Password policy shared across register / change-password / super-admin
 * bootstrap. Intentionally modest to stay out of the user's way while
 * blocking the worst common passwords.
 *
 * Rules:
 *   - at least 12 characters
 *   - must contain at least one letter and one digit
 *   - must NOT equal the email (case-insensitive)
 *
 * Returns: { ok: true } | { ok: false, message: string }
 */
function validatePasswordPolicy(password, { email } = {}) {
  if (typeof password !== 'string') {
    return { ok: false, message: 'Password is required.' };
  }
  if (password.length < 12) {
    return { ok: false, message: 'Password must be at least 12 characters long.' };
  }
  if (!/[A-Za-z]/.test(password)) {
    return { ok: false, message: 'Password must contain at least one letter.' };
  }
  if (!/\d/.test(password)) {
    return { ok: false, message: 'Password must contain at least one digit.' };
  }
  if (email && password.toLowerCase() === String(email).toLowerCase()) {
    return { ok: false, message: 'Password must not match your email address.' };
  }
  return { ok: true };
}

// Centralized bcrypt work factor. Raising this invalidates nothing — existing
// hashes keep validating; only NEW hashes use the higher cost.
const BCRYPT_ROUNDS = 12;

// A real cost-BCRYPT_ROUNDS hash of a throwaway string. The login route runs
// bcrypt.compare() against this when the email doesn't exist, so a failed login
// takes the same wall-clock time whether or not the account exists — closing the
// user-enumeration timing side-channel (SEC-07). Regenerate if BCRYPT_ROUNDS
// changes so the dummy cost matches real hashes.
const DUMMY_BCRYPT_HASH = '$2b$12$OA3eqBiOkZzF9aFfMC3cVu85L1mF4Y4a9Lj0wTO.yUFY0gxwgArI2';

module.exports = { validatePasswordPolicy, BCRYPT_ROUNDS, DUMMY_BCRYPT_HASH };
