// Public self-service sign-up. Open by default so a fresh self-host works out of the
// box; set SIGNUP_ENABLED_DEFAULT=false for invite-only. Not a runtime toggle.
const SIGNUP_ENABLED = process.env.SIGNUP_ENABLED_DEFAULT !== 'false';

export function isSignupEnabled(): boolean {
  return SIGNUP_ENABLED;
}
