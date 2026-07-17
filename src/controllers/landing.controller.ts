import { Request, Response } from 'express';
import LaunchSignup from '../models/LaunchSignup';
import PartnerRequest from '../models/PartnerRequest';
import { sendWaitlistSignupEmail, sendPartnerRequestEmail } from '../services/email.service';
import { sendAdminNotification } from '../socket';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;

const str = (v: unknown, max = 200): string => String(v ?? '').trim().slice(0, max);

/**
 * People write their number every which way: "98765 43210", "+91 98765 43210",
 * "098765-43210", "0091...". Reduce all of them to the bare 10 digits rather than
 * rejecting a number that's perfectly valid, just punctuated differently.
 */
const normalisePhone = (raw: unknown): string => {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 14 && d.startsWith('0091')) d = d.slice(4); // 0091 + 10
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);   // 91 / +91 + 10
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);    // STD-style leading 0
  return d;
};

// ─────────────────────────────────────────────────────────────────────────────
// Public (marketing site) — no auth
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/landing/waitlist — "Notify me at launch" */
export const joinLaunchWaitlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const contact = str(req.body?.contact, 160);
    const roleRaw = str(req.body?.role, 20).toLowerCase();
    const role = roleRaw === 'worker' ? 'worker' : 'customer';
    const source = str(req.body?.source, 40) || 'landing';

    if (!contact) {
      res.status(400).json({ message: 'Enter your email or phone number.' });
      return;
    }

    const isEmail = EMAIL_RE.test(contact);
    const phone = normalisePhone(contact);
    const isPhone = PHONE_RE.test(phone);

    if (!isEmail && !isPhone) {
      res.status(400).json({ message: 'Enter a valid email or 10-digit phone number.' });
      return;
    }

    const key = isEmail ? contact.toLowerCase() : phone;

    // Re-submitting the same contact updates it instead of erroring or duplicating.
    const existing = await LaunchSignup.findOne({ contact: key }).select('_id');

    // Already on the list: tell them so, and stop — no second team email, no
    // notification. The frontend just shows this message.
    if (existing) {
      res.status(200).json({
        already: true,
        message: "You're already on the list — we'll notify you as soon as Fixo launches.",
      });
      return;
    }

    await LaunchSignup.findOneAndUpdate(
      { contact: key },
      {
        $set: {
          contact: key,
          role,
          source,
          ...(isEmail ? { email: key, phone: '' } : { phone, email: '' }),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Respond first — the visitor shouldn't wait on SMTP.
    res.status(201).json({ already: false, message: "You're on the list! We'll notify you at launch." });

    const total = await LaunchSignup.countDocuments();
    void sendWaitlistSignupEmail({ contact: key, role, source, total });
    void sendAdminNotification({
      type: 'launch_waitlist',
      title: 'New waitlist signup',
      message: `${key} joined the launch waitlist${role === 'worker' ? ' (wants to work)' : ''}.`,
      data: { contact: key, role, total },
    });
  } catch (error) {
    console.error('Join launch waitlist error:', error);
    if (!res.headersSent) res.status(500).json({ message: 'Could not sign you up. Please try again.' });
  }
};

/** POST /api/landing/partner — "Partner with Fixo" */
export const submitPartnerRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const fullName = str(req.body?.fullName, 120);
    const company = str(req.body?.company, 160);
    const phoneRaw = str(req.body?.phone, 20);
    const email = str(req.body?.email, 160).toLowerCase();
    const city = str(req.body?.city, 80);
    const partnershipType = str(req.body?.partnershipType, 80);
    const message = str(req.body?.message, 2000);

    if (!fullName || !company) {
      res.status(400).json({ message: 'Name and business/company are required.' });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ message: 'Enter a valid email address.' });
      return;
    }
    const phone = normalisePhone(phoneRaw);
    if (!PHONE_RE.test(phone)) {
      res.status(400).json({ message: 'Enter a valid 10-digit Indian mobile number.' });
      return;
    }

    // Same business shouldn't be able to spam the inbox with duplicate requests.
    // Dedupe on email — tell them we already have it rather than creating another row.
    const existing = await PartnerRequest.findOne({ email }).select('_id');
    if (existing) {
      res.status(200).json({
        already: true,
        message: "We've already received your request — our team will be in touch soon.",
      });
      return;
    }

    await PartnerRequest.create({ fullName, company, phone, email, city, partnershipType, message });

    res.status(201).json({ already: false, message: "Request sent — we'll be in touch within 3 working days." });

    void sendPartnerRequestEmail({ fullName, company, phone, email, city, partnershipType, message });
    void sendAdminNotification({
      type: 'partner_request',
      title: 'New partnership request',
      message: `${fullName} from ${company} wants to partner with Fixo.`,
      data: { fullName, company, phone, email, city, partnershipType },
    });
  } catch (error) {
    console.error('Submit partner request error:', error);
    if (!res.headersSent) res.status(500).json({ message: 'Could not send your request. Please try again.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/admin/landing/waitlist */
export const getLaunchWaitlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
    const role = str(req.query.role, 20);
    const search = str(req.query.search, 80);

    const filter: Record<string, unknown> = {};
    if (role === 'customer' || role === 'worker') filter.role = role;
    if (search) filter.contact = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

    const [items, total, customers, workers, notified] = await Promise.all([
      LaunchSignup.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      LaunchSignup.countDocuments(filter),
      LaunchSignup.countDocuments({ role: 'customer' }),
      LaunchSignup.countDocuments({ role: 'worker' }),
      LaunchSignup.countDocuments({ notified: true }),
    ]);

    res.json({
      items,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      stats: { all: customers + workers, customers, workers, notified },
    });
  } catch (error) {
    console.error('Get launch waitlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** GET /api/admin/landing/partners */
export const getPartnerRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
    const status = str(req.query.status, 20);

    const filter: Record<string, unknown> = {};
    if (['new', 'contacted', 'closed'].includes(status)) filter.status = status;

    const [items, total, newCount, contacted, closed] = await Promise.all([
      PartnerRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      PartnerRequest.countDocuments(filter),
      PartnerRequest.countDocuments({ status: 'new' }),
      PartnerRequest.countDocuments({ status: 'contacted' }),
      PartnerRequest.countDocuments({ status: 'closed' }),
    ]);

    res.json({
      items,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      stats: { all: newCount + contacted + closed, new: newCount, contacted, closed },
    });
  } catch (error) {
    console.error('Get partner requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** PATCH /api/admin/landing/partners/:id — move through new → contacted → closed */
export const updatePartnerRequestStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = str(req.body?.status, 20);
    if (!['new', 'contacted', 'closed'].includes(status)) {
      res.status(400).json({ message: 'Invalid status' });
      return;
    }
    const item = await PartnerRequest.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true });
    if (!item) {
      res.status(404).json({ message: 'Request not found' });
      return;
    }
    res.json({ message: 'Status updated', item });
  } catch (error) {
    console.error('Update partner request status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** PATCH /api/admin/landing/waitlist/:id — mark a signup as notified */
export const markSignupNotified = async (req: Request, res: Response): Promise<void> => {
  try {
    const notified = req.body?.notified !== false;
    const item = await LaunchSignup.findByIdAndUpdate(
      req.params.id,
      { $set: { notified, notifiedAt: notified ? new Date() : null } },
      { new: true }
    );
    if (!item) {
      res.status(404).json({ message: 'Signup not found' });
      return;
    }
    res.json({ message: 'Updated', item });
  } catch (error) {
    console.error('Mark signup notified error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
