export declare const syncSeedAdminCredentials: () => Promise<void>;
export declare const getSeedAdminBootstrapStatus: () => Promise<{
    envConfigured: boolean;
    seedEmail: string | null;
    superadminEmail: string | null;
    emailSynced: boolean;
    passwordSynced: boolean;
    fullySynced: boolean;
}>;
//# sourceMappingURL=adminBootstrap.service.d.ts.map