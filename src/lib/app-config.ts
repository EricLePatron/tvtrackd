/**
 * Central place for the product name while it's still pending legal
 * trademark validation (TMview/INPI) — see CLAUDE.md. Only new code should
 * reference this constant; existing hardcoded "tvtrackd" strings
 * (root route meta, /auth) are a separate, deliberately out-of-scope
 * cleanup for the day the name is settled.
 */
export const APP_NAME = "tvtrackd";
