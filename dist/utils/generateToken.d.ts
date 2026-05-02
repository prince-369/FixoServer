interface TokenPayload {
    id: string;
    role: 'customer' | 'worker' | 'admin';
}
export declare const generateAccessToken: (payload: TokenPayload) => string;
export declare const verifyAccessToken: (token: string) => TokenPayload;
export declare const generateRefreshTokenString: () => string;
export declare const generateToken: (payload: TokenPayload) => string;
export declare const verifyToken: (token: string) => TokenPayload;
export {};
//# sourceMappingURL=generateToken.d.ts.map