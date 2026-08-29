export interface TokenPayload {
    /** User / worker / admin id. */
    id: string;
    role: 'customer' | 'worker' | 'admin';
    /**
     * AuthSession id this token was minted from. Lets a request be traced back to a
     * device and lets "change password" keep the acting session alive. Optional so
     * access tokens issued by the previous implementation still verify during rollout.
     */
    sid?: string;
}
/**
 * Short-lived access token (ACCESS_TOKEN_TTL, default 15m). Deliberately minimal:
 * id, role, session id. No email, phone, name or verification state — those change,
 * and a token is not a profile cache.
 */
export declare const generateAccessToken: (payload: TokenPayload) => string;
export declare const verifyAccessToken: (token: string) => TokenPayload;
/**
 * Legacy opaque refresh string generator.
 * @deprecated Session creation now owns token material — see
 * `createSession` / `rotateSession` in `services/authSession.service.ts`.
 */
export declare const generateRefreshTokenString: () => string;
export declare const generateToken: (payload: TokenPayload) => string;
export declare const verifyToken: (token: string) => TokenPayload;
//# sourceMappingURL=generateToken.d.ts.map