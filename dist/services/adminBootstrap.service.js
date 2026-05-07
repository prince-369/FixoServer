"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSeedAdminBootstrapStatus = exports.syncSeedAdminCredentials = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const Admin_1 = __importDefault(require("../models/Admin"));
const sanitizeEnvValue = (value) => value.trim().replace(/^['"]+|['"]+$/g, '').trim();
const getSeedAdminEmail = () => {
    const raw = process.env.ADMIN_SEED_EMAIL;
    if (!raw)
        return '';
    return sanitizeEnvValue(raw).toLowerCase();
};
const getSeedAdminPassword = () => {
    const raw = process.env.ADMIN_SEED_PASSWORD;
    if (!raw)
        return '';
    return sanitizeEnvValue(raw);
};
const syncSeedAdminCredentials = async () => {
    const seedEmail = getSeedAdminEmail();
    const seedPassword = getSeedAdminPassword();
    if (!seedEmail || !seedPassword) {
        console.log('[INFO] Admin bootstrap sync skipped. Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD in env.');
        return;
    }
    const hashedPassword = await bcryptjs_1.default.hash(seedPassword, 12);
    const admin = await Admin_1.default.findOneAndUpdate({ $or: [{ email: seedEmail }, { role: 'superadmin' }] }, { $set: { email: seedEmail, password: hashedPassword, role: 'superadmin' } }, { upsert: true, returnDocument: 'after', sort: { createdAt: 1 }, setDefaultsOnInsert: true });
    console.log(`[OK] Admin credentials synced from env for ${admin?.email || seedEmail}`);
};
exports.syncSeedAdminCredentials = syncSeedAdminCredentials;
const getSeedAdminBootstrapStatus = async () => {
    const seedEmail = getSeedAdminEmail();
    const seedPassword = getSeedAdminPassword();
    const envConfigured = Boolean(seedEmail && seedPassword);
    const superadmin = await Admin_1.default.findOne({ role: 'superadmin' }).select('email').sort({ createdAt: 1 });
    const seededAdmin = seedEmail
        ? await Admin_1.default.findOne({ email: seedEmail }).select('+password email')
        : null;
    const emailSynced = Boolean(seedEmail && seededAdmin);
    const passwordSynced = Boolean(seedPassword && seededAdmin?.password && (await bcryptjs_1.default.compare(seedPassword, seededAdmin.password)));
    return {
        envConfigured,
        seedEmail: seedEmail || null,
        superadminEmail: superadmin?.email || null,
        emailSynced,
        passwordSynced,
        fullySynced: envConfigured && emailSynced && passwordSynced,
    };
};
exports.getSeedAdminBootstrapStatus = getSeedAdminBootstrapStatus;
//# sourceMappingURL=adminBootstrap.service.js.map