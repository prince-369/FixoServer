import bcrypt from 'bcryptjs';
import Admin from '../models/Admin';
import logger from '../utils/logger';
import { maskEmail } from '../utils/mask';

const sanitizeEnvValue = (value: string): string => value.trim().replace(/^['"]+|['"]+$/g, '').trim();

const getSeedAdminEmail = (): string => {
  const raw = process.env.ADMIN_SEED_EMAIL;
  if (!raw) return '';
  return sanitizeEnvValue(raw).toLowerCase();
};

const getSeedAdminPassword = (): string => {
  const raw = process.env.ADMIN_SEED_PASSWORD;
  if (!raw) return '';
  return sanitizeEnvValue(raw);
};

export const syncSeedAdminCredentials = async (): Promise<void> => {
  const seedEmail = getSeedAdminEmail();
  const seedPassword = getSeedAdminPassword();

  if (!seedEmail || !seedPassword) {
    logger.info('Admin bootstrap sync skipped (ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD not set)');
    return;
  }

  const hashedPassword = await bcrypt.hash(seedPassword, 12);
  const admin = await Admin.findOneAndUpdate(
    { $or: [{ email: seedEmail }, { role: 'superadmin' }] },
    { $set: { email: seedEmail, password: hashedPassword, role: 'superadmin' } },
    { upsert: true, returnDocument: 'after', sort: { createdAt: 1 }, setDefaultsOnInsert: true }
  );

  logger.info('Admin credentials synced from env', { recipientMasked: maskEmail(admin?.email || seedEmail) });
};

export const getSeedAdminBootstrapStatus = async (): Promise<{
  envConfigured: boolean;
  seedEmail: string | null;
  superadminEmail: string | null;
  emailSynced: boolean;
  passwordSynced: boolean;
  fullySynced: boolean;
}> => {
  const seedEmail = getSeedAdminEmail();
  const seedPassword = getSeedAdminPassword();
  const envConfigured = Boolean(seedEmail && seedPassword);

  const superadmin = await Admin.findOne({ role: 'superadmin' }).select('email').sort({ createdAt: 1 });
  const seededAdmin = seedEmail
    ? await Admin.findOne({ email: seedEmail }).select('+password email')
    : null;

  const emailSynced = Boolean(seedEmail && seededAdmin);
  const passwordSynced = Boolean(
    seedPassword && seededAdmin?.password && (await bcrypt.compare(seedPassword, seededAdmin.password))
  );

  return {
    envConfigured,
    seedEmail: seedEmail || null,
    superadminEmail: superadmin?.email || null,
    emailSynced,
    passwordSynced,
    fullySynced: envConfigured && emailSynced && passwordSynced,
  };
};
