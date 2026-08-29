import { Request, Response } from 'express';
export declare const registerCustomer: (req: Request, res: Response) => Promise<void>;
export declare const googleAuthCustomer: (req: Request, res: Response) => Promise<void>;
export declare const completeGoogleRegistration: (req: Request, res: Response) => Promise<void>;
export declare const loginCustomer: (req: Request, res: Response) => Promise<void>;
export declare const googleAuthWorker: (req: Request, res: Response) => Promise<void>;
export declare const registerWorkerWithGoogle: (req: Request, res: Response) => Promise<void>;
export declare const registerWorker: (req: Request, res: Response) => Promise<void>;
export declare const loginWorker: (req: Request, res: Response) => Promise<void>;
export declare const loginAdmin: (req: Request, res: Response) => Promise<void>;
export declare const forgotPassword: (req: Request, res: Response) => Promise<void>;
export declare const verifyOTPHandler: (req: Request, res: Response) => Promise<void>;
export declare const resetPassword: (req: Request, res: Response) => Promise<void>;
export declare const changePassword: (req: Request, res: Response) => Promise<void>;
export declare const getMe: (req: Request, res: Response) => Promise<void>;
export declare const sendPasswordSetupOtp: (req: Request, res: Response) => Promise<void>;
export declare const setPasswordForOAuthUser: (req: Request, res: Response) => Promise<void>;
/**
 * Rotating refresh endpoint. This is the call every client makes on startup to
 * restore a session, and the call the API client makes when an access token expires.
 *
 * On success the presented refresh token is retired and a new one issued, so no
 * refresh token is ever usable twice. The response also carries the full user
 * profile, so a client can restore a session in ONE round trip instead of
 * refresh-then-/auth/me.
 */
export declare const refresh: (req: Request, res: Response) => Promise<void>;
/**
 * Logout is a backend action: the session row is revoked so the refresh token is
 * dead server-side. Clearing client state alone would leave a usable token behind.
 */
export declare const logout: (req: Request, res: Response) => Promise<void>;
export declare const logoutAll: (req: Request, res: Response) => Promise<void>;
/**
 * Exchanges a valid access token for a persistent session.
 *
 * Needed for one case: mobile installs upgraded from the previous version, which
 * persisted an ACCESS token in the keychain and had no refresh token at all. Those
 * users would otherwise be forced to sign in again on first launch after the update.
 *
 * It is `protect`-guarded, so the caller must already hold a valid, unexpired access
 * token — this grants no authority the caller does not already have; it only makes
 * that authority renewable. Idempotent per device: `createSession` replaces any
 * existing session for the same deviceId rather than stacking new ones.
 */
export declare const bootstrapSession: (req: Request, res: Response) => Promise<void>;
export declare const getSessions: (req: Request, res: Response) => Promise<void>;
export declare const revokeSession: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=auth.controller.d.ts.map