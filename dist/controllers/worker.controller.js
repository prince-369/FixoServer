"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unselectSkill = exports.bumpSkillExperience = exports.requestSkill = exports.getSkills = exports.escalateHelpTicket = exports.appendHelpTicketMessage = exports.getHelpTicketDetail = exports.getHelpTickets = exports.createHelpTicket = exports.getChatbotQA = exports.deleteNotification = exports.markAllNotificationsRead = exports.markNotificationRead = exports.getNotifications = exports.getWithdrawals = exports.requestWithdrawal = exports.saveBankDetails = exports.getWalletTransactions = exports.getEarningsHistory = exports.getFunds = exports.completeWork = exports.requestCompletionCode = exports.sendMessage = exports.cancelBookingByWorker = exports.rejectBooking = exports.approveBooking = exports.respondToNegotiation = exports.submitBid = exports.getWorkRequestDetail = exports.getWorkRequests = exports.getReviews = exports.getDashboard = exports.updateCurrentLocation = exports.updateLocation = exports.toggleActive = exports.submitOnboardingSkills = exports.submitOnboardingAadhaar = exports.checkOwnAadhaarDuplicate = exports.validateAadhaarScan = exports.completeProfile = exports.resubmitVerification = exports.submitVerification = exports.updateProfile = exports.getProfile = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Worker_1 = __importStar(require("../models/Worker"));
const aadhaarValidation_service_1 = require("../services/aadhaarValidation.service");
const verhoeff_1 = require("../utils/verhoeff");
const Category_1 = __importDefault(require("../models/Category"));
const Booking_1 = __importDefault(require("../models/Booking"));
const workerSkills_1 = require("../utils/workerSkills");
const WorkBid_1 = __importDefault(require("../models/WorkBid"));
const Transaction_1 = __importDefault(require("../models/Transaction"));
const Withdrawal_1 = __importDefault(require("../models/Withdrawal"));
const Notification_1 = __importDefault(require("../models/Notification"));
const HelpTicket_1 = __importDefault(require("../models/HelpTicket"));
const ChatbotQA_1 = __importDefault(require("../models/ChatbotQA"));
const cloudinary_service_1 = require("../services/cloudinary.service");
const generateTID_1 = require("../utils/generateTID");
const ticketNumber_service_1 = require("../services/ticketNumber.service");
const bookingVoice_service_1 = require("../services/bookingVoice.service");
const env_1 = __importDefault(require("../config/env"));
const socket_1 = require("../socket");
const logger_1 = __importDefault(require("../utils/logger"));
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WORKER_SEARCH_RADIUS_METERS = 10000;
/**
 * An Aadhaar may only back ONE active worker account.
 *
 * "Active" mirrors the admin approve-time guard: approved / pending / resubmitted. A
 * REJECTED account is deliberately not blocking — that person is legitimately
 * re-applying, and blocking them would trap them permanently.
 *
 * Returns the account already holding this Aadhaar, or null when it's free.
 */
const BLOCKING_VERIFICATION_STATUSES = ['approved', 'pending', 'resubmitted'];
const findActiveAadhaarHolder = async (aadhaarDigits, excludeWorkerId) => {
    if (!(0, verhoeff_1.isValidAadhaarNumber)(aadhaarDigits))
        return null;
    const query = {
        aadhaarNumberHash: (0, aadhaarValidation_service_1.hashAadhaarNumber)(aadhaarDigits),
        verificationStatus: { $in: BLOCKING_VERIFICATION_STATUSES },
    };
    if (excludeWorkerId)
        query._id = { $ne: excludeWorkerId };
    const holder = await Worker_1.default.findOne(query).select('fullName verificationStatus').lean();
    return holder ? { fullName: holder.fullName || 'another worker', verificationStatus: holder.verificationStatus } : null;
};
/** Single wording for the block, so the app and the API always say the same thing. */
const duplicateAadhaarMessage = (holderName) => `This Aadhaar card is already registered with another Fixo account (${holderName}). ` +
    'Please use a different Aadhaar card.';
const hasValidCoordinates = (coordinates) => {
    if (!Array.isArray(coordinates) || coordinates.length !== 2)
        return false;
    return Number.isFinite(Number(coordinates[0])) && Number.isFinite(Number(coordinates[1]));
};
const toCoordinateTuple = (coordinates) => {
    if (!hasValidCoordinates(coordinates))
        return null;
    return [Number(coordinates[0]), Number(coordinates[1])];
};
const isGeoIndexMissingError = (error) => {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    return (message.includes('$geonear') ||
        message.includes('unable to find index') ||
        message.includes('2dsphere index'));
};
const toRadians = (value) => (value * Math.PI) / 180;
const distanceMetersBetween = (a, b) => {
    // Coordinates are [longitude, latitude]
    const [lng1, lat1] = a;
    const [lng2, lat2] = b;
    const earthRadiusMeters = 6371000;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const lat1Rad = toRadians(lat1);
    const lat2Rad = toRadians(lat2);
    const haversine = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) ** 2;
    const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    return earthRadiusMeters * arc;
};
const findAvailableBookingsForWorker = async (worker, findingWorkersSince) => {
    return Booking_1.default.find({
        $or: [
            { status: 'finding_workers', createdAt: { $gte: findingWorkersSince } },
            { status: 'bids_received' },
        ],
        category: { $in: worker.categories },
        customerLocation: {
            $nearSphere: {
                $geometry: {
                    type: 'Point',
                    coordinates: worker.location.coordinates,
                },
                $maxDistance: WORKER_SEARCH_RADIUS_METERS,
            },
        },
    })
        .populate('category', 'name slug image')
        .populate('customer', 'fullName')
        .sort({ createdAt: -1 })
        // Plain objects: getWorkRequests only spreads these into the JSON response + attaches
        // myBid; no Mongoose document methods/virtuals are used downstream.
        .lean();
};
const resolveAvailableBookingsForWorker = async (worker, findingWorkersSince) => {
    try {
        return await findAvailableBookingsForWorker(worker, findingWorkersSince);
    }
    catch (error) {
        if (!isGeoIndexMissingError(error)) {
            throw error;
        }
        logger_1.default.error('Booking geo index missing for work requests. Attempting self-heal.', { err: error });
        try {
            await Booking_1.default.collection.createIndex({ customerLocation: '2dsphere' }, { name: 'customerLocation_2dsphere' });
            return await findAvailableBookingsForWorker(worker, findingWorkersSince);
        }
        catch (retryError) {
            logger_1.default.error('Booking geo index self-heal failed. Returning without available bookings.', { err: retryError });
            return [];
        }
    }
};
// ─── Get Worker Profile ───
const getProfile = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.user.id).populate('categories');
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        res.json({ worker });
    }
    catch (error) {
        logger_1.default.error('Get worker profile error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getProfile = getProfile;
// ─── Update Worker Profile ───
const updateProfile = async (req, res) => {
    try {
        const { bio, regularPhone, extraPhones, categories, location } = req.body;
        const updateData = {};
        if (bio !== undefined)
            updateData.bio = bio;
        if (regularPhone)
            updateData.regularPhone = regularPhone;
        if (extraPhones)
            updateData.extraPhones = extraPhones;
        if (categories)
            updateData.categories = categories;
        if (location)
            updateData.location = location;
        if (req.file) {
            const uploaded = await (0, cloudinary_service_1.uploadBufferToCloudinary)(req.file.buffer, 'workers');
            updateData.profileImage = uploaded.url;
        }
        const worker = await Worker_1.default.findByIdAndUpdate(req.user.id, updateData, { new: true }).populate('categories');
        res.json({ message: 'Profile updated', worker });
    }
    catch (error) {
        logger_1.default.error('Update worker profile error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.updateProfile = updateProfile;
// ─── Verification helpers ───
// Indian mobile: 10 digits starting 6-9. Accepts +91/0 prefixes and strips them.
const normaliseIndianMobile = (raw) => {
    const digits = String(raw ?? '').replace(/\D/g, '');
    const trimmed = digits.length > 10 ? digits.slice(-10) : digits;
    return /^[6-9]\d{9}$/.test(trimmed) ? trimmed : '';
};
const isVerificationSlot = (value) => typeof value === 'string' && Worker_1.VERIFICATION_SLOTS.includes(value);
// Shared guard for submit + resubmit: the worker must have finished every onboarding
// step (Aadhaar, at least one confirmed skill) and supplied a slot + WhatsApp number.
const readVerificationPayload = (body) => {
    const slot = body?.verificationSlot;
    if (!isVerificationSlot(slot)) {
        return { ok: false, message: 'Please choose a valid verification time slot.' };
    }
    const whatsapp = normaliseIndianMobile(body?.whatsappNumber);
    if (!whatsapp) {
        return { ok: false, message: 'Enter a valid 10-digit Indian WhatsApp number.' };
    }
    return { ok: true, slot, whatsapp };
};
// ─── Submit for manual verification (end of onboarding) ───
const submitVerification = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.user.id);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        if (worker.verificationStatus === 'pending' || worker.verificationStatus === 'resubmitted') {
            res.status(400).json({ message: 'Your verification is already awaiting review.' });
            return;
        }
        if (worker.verificationStatus === 'approved') {
            res.status(400).json({ message: 'Your account is already verified.' });
            return;
        }
        if (!worker.aadhaarFront || !worker.aadhaarBack) {
            res.status(400).json({ message: 'Please upload your Aadhaar card first.' });
            return;
        }
        if (!worker.skills?.some((s) => s.confirmed)) {
            res.status(400).json({ message: 'Please select and confirm at least one skill first.' });
            return;
        }
        const payload = readVerificationPayload(req.body || {});
        if (!payload.ok) {
            res.status(400).json({ message: payload.message });
            return;
        }
        worker.verificationSlot = payload.slot;
        worker.whatsappNumber = payload.whatsapp;
        worker.verificationStatus = 'pending';
        worker.verificationSubmittedAt = new Date();
        worker.rejectionReason = '';
        await worker.save();
        const populated = await Worker_1.default.findById(worker._id).populate('categories');
        (0, socket_1.notifyVerificationStatus)(worker, 'pending');
        await (0, socket_1.sendNotification)({
            recipientId: worker._id.toString(),
            recipientModel: 'Worker',
            type: 'verification_submitted',
            title: 'Verification Submitted',
            message: 'Your details are submitted. Our team will contact you on WhatsApp in your chosen time slot.',
            data: { workerId: worker._id.toString(), verificationSlot: payload.slot },
        });
        await (0, socket_1.sendAdminNotification)({
            type: 'verification_pending',
            title: 'New Worker Verification',
            message: `${worker.fullName} submitted verification (${Worker_1.VERIFICATION_SLOT_LABELS[payload.slot]}).`,
            data: {
                workerId: worker._id.toString(),
                workerName: worker.fullName,
                verificationSlot: payload.slot,
                whatsappNumber: payload.whatsapp,
            },
        });
        res.json({
            message: 'Verification submitted. Our team will contact you in your selected time slot.',
            worker: withOnboardingFlags(populated),
        });
    }
    catch (error) {
        logger_1.default.error('Submit verification error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.submitVerification = submitVerification;
// ─── Resubmit verification after rejection ───
const resubmitVerification = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.user.id);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        if (worker.verificationStatus !== 'rejected') {
            res.status(400).json({ message: 'Resubmission is only allowed after a rejection.' });
            return;
        }
        const files = req.files;
        const nextFullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
        const nextEmailRaw = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        if (!nextFullName) {
            res.status(400).json({ message: 'Full name is required' });
            return;
        }
        if (nextEmailRaw && nextEmailRaw !== (worker.email || '').toLowerCase()) {
            const emailOwner = await Worker_1.default.findOne({ email: nextEmailRaw, _id: { $ne: worker._id } }).select('_id');
            if (emailOwner) {
                res.status(400).json({ message: 'Email is already in use by another worker account' });
                return;
            }
            worker.email = nextEmailRaw;
        }
        worker.fullName = nextFullName;
        const frontFile = files?.aadhaarFront?.[0];
        const backFile = files?.aadhaarBack?.[0];
        if (frontFile) {
            // A re-request often carries a corrected/different Aadhaar, so re-derive the
            // duplicate-detection hash + printed details from the NEW front image.
            const frontInspect = await (0, aadhaarValidation_service_1.inspectAadhaar)(frontFile.buffer);
            const details = frontInspect.details;
            const ocrDigits = details.aadhaarNumber ? (0, aadhaarValidation_service_1.normaliseAadhaarDigits)(details.aadhaarNumber) : '';
            const manualDigits = (0, aadhaarValidation_service_1.normaliseAadhaarDigits)(String(req.body?.aadhaarNumber || ''));
            const digits = (0, verhoeff_1.isValidAadhaarNumber)(ocrDigits) ? ocrDigits : (0, verhoeff_1.isValidAadhaarNumber)(manualDigits) ? manualDigits : '';
            // Same duplicate gate as onboarding — a rejected worker re-applying must not be
            // able to slip in someone else's Aadhaar. Runs before the upload.
            if (digits) {
                const holder = await findActiveAadhaarHolder(digits, worker.id);
                if (holder) {
                    res.status(409).json({
                        message: duplicateAadhaarMessage(holder.fullName),
                        duplicate: true,
                        holderName: holder.fullName,
                    });
                    return;
                }
                worker.aadhaarNumberHash = (0, aadhaarValidation_service_1.hashAadhaarNumber)(digits);
                worker.aadhaarNumberLast4 = digits.slice(-4);
            }
            if (details.name)
                worker.aadhaarName = details.name;
            if (details.dob)
                worker.aadhaarDob = details.dob;
            const frontUpload = await (0, cloudinary_service_1.uploadBufferToCloudinary)(frontFile.buffer, 'aadhaar');
            worker.aadhaarFront = frontUpload.url;
        }
        if (backFile) {
            const backUpload = await (0, cloudinary_service_1.uploadBufferToCloudinary)(backFile.buffer, 'aadhaar');
            worker.aadhaarBack = backUpload.url;
        }
        // Slot + WhatsApp are editable on resubmission; both remain mandatory.
        const payload = readVerificationPayload(req.body || {});
        if (!payload.ok) {
            res.status(400).json({ message: payload.message });
            return;
        }
        const previousReason = worker.rejectionReason || '';
        // Move the worker back into the admin's verification queue.
        worker.verificationSlot = payload.slot;
        worker.whatsappNumber = payload.whatsapp;
        worker.verificationStatus = 'resubmitted';
        worker.resubmittedAt = new Date();
        worker.verificationSubmittedAt = new Date();
        worker.rejectionReason = '';
        worker.verifiedBy = null;
        worker.verifiedAt = null;
        worker.accountStatus = 'test';
        worker.isActive = false;
        await worker.save();
        const updatedWorker = await Worker_1.default.findById(worker._id).populate('categories');
        (0, socket_1.notifyVerificationStatus)(worker, 'resubmitted');
        await (0, socket_1.sendNotification)({
            recipientId: worker._id.toString(),
            recipientModel: 'Worker',
            type: 'verification_resubmitted',
            title: 'Verification Resubmitted',
            message: 'Your updated details are submitted. Our team will contact you again in your chosen time slot.',
            data: { workerId: worker._id.toString(), verificationSlot: payload.slot },
        });
        await (0, socket_1.sendAdminNotification)({
            type: 'verification_resubmitted',
            title: 'Worker Resubmitted Verification',
            message: `${worker.fullName} resubmitted verification after rejection.`,
            data: {
                workerId: worker._id.toString(),
                workerName: worker.fullName,
                previousReason,
                verificationSlot: payload.slot,
                whatsappNumber: payload.whatsapp,
            },
        });
        res.json({
            message: 'Details updated. Your verification has been resubmitted.',
            worker: withOnboardingFlags(updatedWorker),
        });
    }
    catch (error) {
        logger_1.default.error('Resubmit verification error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.resubmitVerification = resubmitVerification;
// ─── Complete Profile ───
const completeProfile = async (req, res) => {
    try {
        const { bio, regularPhone, latitude, longitude, address } = req.body;
        const worker = await Worker_1.default.findById(req.user.id);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        if (worker.verificationStatus !== 'approved') {
            res.status(400).json({ message: 'Your account must be verified before completing your profile' });
            return;
        }
        // Build location from lat/lng/address
        if (latitude && longitude) {
            worker.location = {
                type: 'Point',
                coordinates: [parseFloat(longitude), parseFloat(latitude)],
                address: address || '',
            };
        }
        // Skills (and therefore categories) are chosen at registration and approved
        // during KYC — they are not (re)submitted here.
        if (bio)
            worker.bio = bio;
        if (regularPhone)
            worker.regularPhone = regularPhone;
        if (req.file) {
            const uploaded = await (0, cloudinary_service_1.uploadBufferToCloudinary)(req.file.buffer, 'workers');
            worker.profileImage = uploaded.url;
        }
        worker.profileCompleted = true;
        worker.accountStatus = 'live';
        await worker.save();
        const populated = await Worker_1.default.findById(worker._id).populate('categories');
        res.json({ message: 'Profile completed! You are now live.', worker: populated });
    }
    catch (error) {
        logger_1.default.error('Complete profile error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.completeProfile = completeProfile;
// ─── Onboarding helpers (aadhaar + skills submitted AFTER account creation) ───
const withOnboardingFlags = (w) => w
    ? {
        ...(typeof w.toObject === 'function' ? w.toObject() : w),
        aadhaarSubmitted: Boolean(w.aadhaarFront && w.aadhaarBack),
        skillsCount: Array.isArray(w.skills) ? w.skills.length : 0,
        // The worker has everything needed to submit for manual verification.
        readyForVerification: Boolean(w.aadhaarFront && w.aadhaarBack) &&
            Array.isArray(w.skills) &&
            w.skills.some((s) => s?.confirmed),
    }
    : w;
const parseOnboardingSkills = (raw) => {
    let arr = raw;
    if (typeof raw === 'string') {
        try {
            arr = JSON.parse(raw);
        }
        catch {
            arr = [];
        }
    }
    if (!Array.isArray(arr))
        return [];
    return arr
        .filter((s) => Boolean(s) && typeof s === 'object' && Boolean(s.categoryId))
        .map((s) => ({
        categoryId: String(s.categoryId),
        experienceYears: Number(s.experienceYears) || 0,
        confirmed: s.confirmed === true || s.confirmed === 'true',
    }));
};
// ─── Live-scan / manual Aadhaar validation (single side) ───
const validateAadhaarScan = async (req, res) => {
    try {
        const file = req.file;
        const side = String(req.body?.side || '').toLowerCase();
        if (!file) {
            res.status(400).json({ message: 'No image received' });
            return;
        }
        if (side !== 'front' && side !== 'back') {
            res.status(400).json({ message: 'side must be "front" or "back"' });
            return;
        }
        const result = await (0, aadhaarValidation_service_1.validateAadhaarSide)(file.buffer, side);
        res.json(result);
    }
    catch (error) {
        logger_1.default.error('Validate aadhaar scan error:', { err: error });
        res.status(500).json({ message: 'Could not validate image' });
    }
};
exports.validateAadhaarScan = validateAadhaarScan;
// ─── Aadhaar duplicate pre-check (worker-facing) ───
// Called by the scanner BEFORE the worker can continue, so a duplicate is caught at the
// scan step instead of after an upload. Also covers the manually-typed number for cards
// whose printed number OCR couldn't read.
const checkOwnAadhaarDuplicate = async (req, res) => {
    try {
        const digits = (0, aadhaarValidation_service_1.normaliseAadhaarDigits)(String(req.body?.aadhaarNumber || ''));
        if (!(0, verhoeff_1.isValidAadhaarNumber)(digits)) {
            res.status(400).json({ message: 'Enter a valid 12-digit Aadhaar number.' });
            return;
        }
        // Exclude the caller: re-scanning your own card (e.g. after a rejection) is normal.
        const holder = await findActiveAadhaarHolder(digits, req.user.id);
        if (holder) {
            res.json({ duplicate: true, holderName: holder.fullName, message: duplicateAadhaarMessage(holder.fullName) });
            return;
        }
        res.json({ duplicate: false });
    }
    catch (error) {
        logger_1.default.error('Check own aadhaar duplicate failed', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.checkOwnAadhaarDuplicate = checkOwnAadhaarDuplicate;
// ─── Onboarding Step 1: Upload Aadhaar ───
const submitOnboardingAadhaar = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.user.id);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        const files = req.files;
        const front = files?.aadhaarFront?.[0];
        const back = files?.aadhaarBack?.[0];
        if (!front || !back) {
            res.status(400).json({ message: 'Aadhaar card front and back photos are required' });
            return;
        }
        // Server-side guard: reject if either image clearly isn't an Aadhaar card.
        // The front pass also extracts the printed details (name/dob/number) to store.
        const [frontInspect, backOk] = await Promise.all([
            (0, aadhaarValidation_service_1.inspectAadhaar)(front.buffer),
            (0, aadhaarValidation_service_1.looksLikeAadhaar)(back.buffer),
        ]);
        if (!frontInspect.looksAadhaar || !backOk) {
            res.status(400).json({ message: 'Please upload valid Aadhaar card photos (front and back).' });
            return;
        }
        // Number for the duplicate-detection hash: prefer the OCR-read one, else the
        // number the worker typed in when OCR couldn't read it. Both are Verhoeff-checked.
        const details = frontInspect.details;
        const ocrDigits = details.aadhaarNumber ? (0, aadhaarValidation_service_1.normaliseAadhaarDigits)(details.aadhaarNumber) : '';
        const manualDigits = (0, aadhaarValidation_service_1.normaliseAadhaarDigits)(String(req.body?.aadhaarNumber || ''));
        const digits = (0, verhoeff_1.isValidAadhaarNumber)(ocrDigits) ? ocrDigits : (0, verhoeff_1.isValidAadhaarNumber)(manualDigits) ? manualDigits : '';
        // Duplicate gate runs BEFORE the upload: the app pre-checks, but a client can be
        // bypassed, and we must not store another account's Aadhaar images.
        if (digits) {
            const holder = await findActiveAadhaarHolder(digits, worker.id);
            if (holder) {
                res.status(409).json({
                    message: duplicateAadhaarMessage(holder.fullName),
                    duplicate: true,
                    holderName: holder.fullName,
                });
                return;
            }
        }
        const [frontUpload, backUpload] = await Promise.all([
            (0, cloudinary_service_1.uploadBufferToCloudinary)(front.buffer, 'aadhaar'),
            (0, cloudinary_service_1.uploadBufferToCloudinary)(back.buffer, 'aadhaar'),
        ]);
        // Persist the extracted details (number stored only as a hash) so admins can
        // detect duplicate accounts made with the same Aadhaar.
        if (digits) {
            worker.aadhaarNumberHash = (0, aadhaarValidation_service_1.hashAadhaarNumber)(digits);
            worker.aadhaarNumberLast4 = digits.slice(-4);
        }
        if (details.name)
            worker.aadhaarName = details.name;
        if (details.dob)
            worker.aadhaarDob = details.dob;
        worker.aadhaarFront = frontUpload.url;
        worker.aadhaarBack = backUpload.url;
        await worker.save();
        const populated = await Worker_1.default.findById(worker._id).populate('categories');
        res.json({ message: 'Aadhaar uploaded successfully.', worker: withOnboardingFlags(populated) });
    }
    catch (error) {
        logger_1.default.error('Submit onboarding aadhaar error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.submitOnboardingAadhaar = submitOnboardingAadhaar;
// ─── Onboarding Step 2: Select Skills ───
const submitOnboardingSkills = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.user.id);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        const parsed = parseOnboardingSkills(req.body?.skills);
        if (!parsed.some((s) => s.confirmed)) {
            res.status(400).json({ message: 'Select at least one skill you can do and confirm it.' });
            return;
        }
        worker.skills = parsed.map((s) => ({
            category: s.categoryId,
            experienceYears: s.experienceYears,
            confirmed: s.confirmed,
            status: 'pending_kyc',
            experienceBumpsUsed: 0,
            callAttempts: 0,
            requestedAt: new Date(),
            decidedAt: null,
        }));
        await worker.save();
        const populated = await Worker_1.default.findById(worker._id).populate('categories');
        res.json({ message: 'Skills saved successfully.', worker: withOnboardingFlags(populated) });
    }
    catch (error) {
        logger_1.default.error('Submit onboarding skills error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.submitOnboardingSkills = submitOnboardingSkills;
// ─── Toggle Active Status ───
const toggleActive = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.user.id);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        if (worker.accountStatus !== 'live') {
            res.status(400).json({ message: 'Account must be live to toggle active status' });
            return;
        }
        worker.isActive = !worker.isActive;
        await worker.save();
        // Let customers' availability previews update live when a worker goes online/offline.
        const coords = worker.currentLocation?.coordinates || worker.location?.coordinates;
        (0, socket_1.notifyRole)('customer', 'workers:availability-changed', {
            workerId: worker._id.toString(),
            isActive: worker.isActive,
            coordinates: Array.isArray(coords) ? coords : null,
        });
        res.json({ message: `You are now ${worker.isActive ? 'Active' : 'Inactive'}`, isActive: worker.isActive });
    }
    catch (error) {
        logger_1.default.error('Toggle active error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.toggleActive = toggleActive;
// ─── Update Location ───
const updateLocation = async (req, res) => {
    try {
        const { latitude, longitude, address } = req.body;
        const coordinates = [longitude, latitude]; // MongoDB expects [lng, lat]
        const worker = await Worker_1.default.findByIdAndUpdate(req.user.id, { location: { type: 'Point', coordinates, address } }, { new: true });
        res.json({ message: 'Location updated', location: worker?.location });
    }
    catch (error) {
        logger_1.default.error('Update location error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.updateLocation = updateLocation;
// ─── Update LIVE/current location (dynamic job-matching radius) ───
// Does NOT change the static signup `location`. Called periodically by the
// worker app/web so the 10km radius follows the worker as they move.
const updateCurrentLocation = async (req, res) => {
    try {
        const lat = Number(req.body?.latitude);
        const lng = Number(req.body?.longitude);
        const address = typeof req.body?.address === 'string' ? req.body.address : '';
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            res.status(400).json({ message: 'Valid latitude and longitude are required' });
            return;
        }
        await Worker_1.default.findByIdAndUpdate(req.user.id, {
            currentLocation: { type: 'Point', coordinates: [lng, lat], address, updatedAt: new Date() },
        });
        res.json({ message: 'Live location updated' });
    }
    catch (error) {
        logger_1.default.error('Update current location error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.updateCurrentLocation = updateCurrentLocation;
// ─── Dashboard Stats ───
const getDashboard = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.user.id);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        const workerId = worker._id;
        // ── Active/Pending bookings ──
        const activeBookings = await Booking_1.default.find({
            assignedWorker: workerId,
            status: { $nin: ['completed', 'cancelled'] },
        })
            .populate('category', 'name slug')
            .populate('customer', 'fullName phone')
            .sort({ createdAt: -1 })
            .limit(5);
        // ── Completed bookings for reviews & stats ──
        const completedBookings = await Booking_1.default.find({
            assignedWorker: workerId,
            status: 'completed',
        });
        const reviews = completedBookings
            .filter((b) => b.review?.rating)
            .map((b) => ({
            rating: b.review.rating,
            feedback: b.review.feedback,
            createdAt: b.review.createdAt,
        }));
        // ── Daily earnings for last 30 days (for graph) ──
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dailyEarnings = await Transaction_1.default.aggregate([
            {
                $match: {
                    worker: workerId,
                    type: 'worker_earning',
                    status: 'completed',
                    createdAt: { $gte: thirtyDaysAgo },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                    cash: { $sum: { $cond: [{ $eq: ['$method', 'cash'] }, '$amount', 0] } },
                    online: { $sum: { $cond: [{ $eq: ['$method', 'online'] }, '$amount', 0] } },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        // ── Monthly earnings for last 6 months ──
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const monthlyEarnings = await Transaction_1.default.aggregate([
            {
                $match: {
                    worker: workerId,
                    type: 'worker_earning',
                    status: 'completed',
                    createdAt: { $gte: sixMonthsAgo },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                    cash: { $sum: { $cond: [{ $eq: ['$method', 'cash'] }, '$amount', 0] } },
                    online: { $sum: { $cond: [{ $eq: ['$method', 'online'] }, '$amount', 0] } },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        // ── Payment method breakdown ──
        const paymentBreakdown = await Transaction_1.default.aggregate([
            {
                $match: {
                    worker: workerId,
                    type: 'worker_earning',
                    status: 'completed',
                },
            },
            {
                $group: {
                    _id: '$method',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ]);
        const cashTotal = paymentBreakdown.find((p) => p._id === 'cash')?.total || 0;
        const onlineTotal = paymentBreakdown.find((p) => p._id === 'online')?.total || 0;
        const cashJobs = paymentBreakdown.find((p) => p._id === 'cash')?.count || 0;
        const onlineJobs = paymentBreakdown.find((p) => p._id === 'online')?.count || 0;
        // ── This week vs last week comparison ──
        const now = new Date();
        const startOfThisWeek = new Date(now);
        startOfThisWeek.setDate(now.getDate() - now.getDay());
        startOfThisWeek.setHours(0, 0, 0, 0);
        const startOfLastWeek = new Date(startOfThisWeek);
        startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
        const weeklyComparison = await Transaction_1.default.aggregate([
            {
                $match: {
                    worker: workerId,
                    type: 'worker_earning',
                    status: 'completed',
                    createdAt: { $gte: startOfLastWeek },
                },
            },
            {
                $group: {
                    _id: {
                        $cond: [{ $gte: ['$createdAt', startOfThisWeek] }, 'thisWeek', 'lastWeek'],
                    },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ]);
        const thisWeekEarnings = weeklyComparison.find((w) => w._id === 'thisWeek')?.total || 0;
        const lastWeekEarnings = weeklyComparison.find((w) => w._id === 'lastWeek')?.total || 0;
        const thisWeekJobs = weeklyComparison.find((w) => w._id === 'thisWeek')?.count || 0;
        // ── Pending bids count ──
        const pendingBids = await WorkBid_1.default.countDocuments({
            worker: workerId,
            status: 'pending',
        });
        // ── Today's earnings ──
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const todayAgg = await Transaction_1.default.aggregate([
            {
                $match: {
                    worker: workerId,
                    type: 'worker_earning',
                    status: 'completed',
                    createdAt: { $gte: startOfToday },
                },
            },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]);
        const todayEarnings = todayAgg[0]?.total || 0;
        const todayJobs = todayAgg[0]?.count || 0;
        res.json({
            stats: {
                totalWorkDone: worker.totalWorkDone,
                totalEarnings: worker.totalEarnings,
                rating: worker.rating,
                balance: worker.balance,
                isActive: worker.isActive,
                cashTotal,
                onlineTotal,
                cashJobs,
                onlineJobs,
                thisWeekEarnings,
                lastWeekEarnings,
                thisWeekJobs,
                todayEarnings,
                todayJobs,
                pendingBids,
                pendingBookings: activeBookings.filter((b) => ['worker_accepted', 'worker_approved', 'payment_done'].includes(b.status)).length,
                activeBookings: activeBookings.filter((b) => b.status === 'in_progress').length,
            },
            activeBookings,
            reviews,
            dailyEarnings,
            monthlyEarnings,
        });
    }
    catch (error) {
        logger_1.default.error('Get dashboard error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getDashboard = getDashboard;
// ─── Get Reviews / Ratings ───
const getReviews = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.user.id);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        const reviewedBookings = await Booking_1.default.find({
            assignedWorker: req.user.id,
            status: 'completed',
            'review.rating': { $exists: true, $ne: null },
        })
            .populate('customer', 'fullName profileImage')
            .populate('category', 'name slug image')
            .sort({ updatedAt: -1 });
        const reviews = reviewedBookings
            .filter((b) => b.review && b.review.rating)
            .map((b) => {
            const customer = b.customer && typeof b.customer === 'object' && '_id' in b.customer
                ? { fullName: b.customer.fullName || 'Customer', profileImage: b.customer.profileImage || '' }
                : null;
            const category = b.category && typeof b.category === 'object' && '_id' in b.category
                ? { name: b.category.name || 'Service', slug: b.category.slug || '' }
                : null;
            return {
                _id: b._id,
                rating: b.review.rating,
                feedback: b.review.feedback || '',
                createdAt: b.review.createdAt || b.updatedAt,
                customer,
                category,
                amount: b.amount || 0,
                workDescription: b.workDescription || '',
            };
        });
        res.json({
            rating: worker.rating,
            totalReviews: reviews.length,
            reviews,
        });
    }
    catch (error) {
        logger_1.default.error('Get reviews error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getReviews = getReviews;
// ─── Get Work Requests ───
const getWorkRequests = async (req, res) => {
    try {
        // Backward-compatible scope. Omitted → full response (available + active + completed),
        // the unchanged contract. `available` → only the available list (+ this worker's bids)
        // for the high-frequency real-time fallback. Any other value is rejected.
        const scopeRaw = req.query.scope;
        const scope = scopeRaw === undefined ? 'full' : String(scopeRaw);
        if (scope !== 'full' && scope !== 'available') {
            res.status(400).json({ message: "Invalid scope. Use 'available' or omit for the full list." });
            return;
        }
        // Only the fields getWorkRequests genuinely reads (eligibility + geo + categories).
        // Lean + select: no document methods/virtuals/save are used on this worker.
        const worker = await Worker_1.default.findById(req.user.id)
            .select('categories currentLocation location accountStatus isActive')
            .lean();
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        // 1) Available bookings — in worker's categories + 10km radius
        // Show finding_workers jobs within the same stale-window used by cleanup.
        const findingWorkersSince = new Date(Date.now() - env_1.default.JOB_STALE_BOOKING_MINUTES * 60 * 1000);
        const workerCoordinates = toCoordinateTuple(worker.currentLocation?.coordinates) || toCoordinateTuple(worker.location?.coordinates);
        const hasCategories = Array.isArray(worker.categories) && worker.categories.length > 0;
        // Eligibility parity with creation-time matching (findNearbyWorkers): only a live,
        // online worker is matched for new jobs, so only such a worker sees the available
        // pool here. Their own active/completed jobs (below) are unaffected by this.
        const eligibleForAvailable = worker.accountStatus === 'live' && worker.isActive === true;
        let availableBookings = [];
        if (eligibleForAvailable && hasCategories && workerCoordinates) {
            // Minimal geo-worker shape (normalized tuple so the query always gets numeric lng/lat).
            const geoWorker = { categories: worker.categories, location: { coordinates: workerCoordinates } };
            try {
                availableBookings = await resolveAvailableBookingsForWorker(geoWorker, findingWorkersSince);
            }
            catch (availableError) {
                logger_1.default.error('Available booking lookup failed. Returning active/completed requests only.', { err: availableError });
                availableBookings = [];
            }
        }
        // Check which ones this worker already bid on. Lean: myBid is spread into JSON as-is.
        // Skip the round-trip entirely when there are no available bookings to match.
        const existingBids = availableBookings.length
            ? await WorkBid_1.default.find({
                worker: req.user.id,
                booking: { $in: availableBookings.map((b) => b._id) },
            }).lean()
            : [];
        const bidMap = new Map(existingBids.map((b) => [String(b.booking), b]));
        const available = availableBookings.map((booking) => ({
            ...booking,
            myBid: bidMap.get(String(booking._id)) || null,
        }));
        // scope=available: return ONLY the available list (+ bids). Active/completed personal
        // history is deliberately NOT queried on this hot path.
        if (scope === 'available') {
            res.json({ requests: available });
            return;
        }
        // 2) Active bookings — assigned to this worker, in progress
        const activeBookings = await Booking_1.default.find({
            assignedWorker: req.user.id,
            status: { $in: ['worker_accepted', 'worker_approved', 'payment_done', 'in_progress'] },
        })
            .populate('category', 'name slug image')
            .populate('customer', 'fullName phone')
            .sort({ createdAt: -1 })
            .lean();
        // 3) Completed/cancelled bookings for this worker
        const completedBookings = await Booking_1.default.find({
            assignedWorker: req.user.id,
            status: { $in: ['completed', 'cancelled'] },
        })
            .populate('category', 'name slug image')
            .populate('customer', 'fullName')
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();
        const requests = [...available, ...activeBookings, ...completedBookings];
        res.json({ requests });
    }
    catch (error) {
        logger_1.default.error('Get work requests error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getWorkRequests = getWorkRequests;
// ─── Get Single Work Request Detail ───
const getWorkRequestDetail = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.user.id);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        const booking = await Booking_1.default.findById(req.params.id)
            .populate('category', 'name slug image')
            .populate('customer', 'fullName phone');
        if (!booking) {
            res.status(404).json({ message: 'Booking not found' });
            return;
        }
        // Only allow access if: worker is assigned, or booking is available (in worker's categories + 10km radius)
        const isAssigned = booking.assignedWorker?.toString() === req.user.id;
        const isOpenStatus = ['finding_workers', 'bids_received'].includes(booking.status);
        const workerCategorySet = new Set((worker.categories || []).map((id) => id.toString()));
        const bookingCategoryId = booking.category && typeof booking.category === 'object' && '_id' in booking.category
            ? String(booking.category._id)
            : String(booking.category || '');
        const isCategoryMatch = bookingCategoryId ? workerCategorySet.has(bookingCategoryId) : false;
        const workerCoordinates = toCoordinateTuple(worker.currentLocation?.coordinates) || toCoordinateTuple(worker.location?.coordinates);
        const bookingCoordinates = toCoordinateTuple(booking.customerLocation?.coordinates);
        const isWithinRadius = Boolean(workerCoordinates && bookingCoordinates) &&
            distanceMetersBetween(workerCoordinates, bookingCoordinates) <= WORKER_SEARCH_RADIUS_METERS;
        const isAvailable = isOpenStatus && isCategoryMatch && isWithinRadius;
        if (!isAssigned && !isAvailable) {
            res.status(403).json({ message: 'Access denied' });
            return;
        }
        // Check if this worker already bid
        const myBid = await WorkBid_1.default.findOne({ booking: booking._id, worker: req.user.id });
        res.json({
            booking: {
                ...booking.toObject(),
                myBid: myBid || null,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Get work request detail error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getWorkRequestDetail = getWorkRequestDetail;
// ─── Submit Bid ───
const submitBid = async (req, res) => {
    try {
        const { priceOffered } = req.body;
        const bidMessage = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 500) : '';
        const bookingIdParam = req.params.bookingId;
        const bookingId = Array.isArray(bookingIdParam) ? bookingIdParam[0] : bookingIdParam;
        if (!bookingId) {
            res.status(400).json({ message: 'Invalid booking id' });
            return;
        }
        const workerDoc = await Worker_1.default.findById(req.user.id).select('isActive');
        if (!workerDoc?.isActive) {
            res.status(403).json({ message: 'You must be active to place bids. Turn on your availability toggle.' });
            return;
        }
        const booking = await Booking_1.default.findById(bookingId);
        if (!booking || !['finding_workers', 'bids_received'].includes(booking.status)) {
            res.status(400).json({ message: 'Cannot bid on this booking' });
            return;
        }
        const existingBid = await WorkBid_1.default.findOne({ booking: bookingId, worker: req.user.id });
        if (existingBid) {
            if (existingBid.status === 'rejected') {
                existingBid.priceOffered = priceOffered;
                existingBid.message = bidMessage;
                existingBid.status = 'pending';
                await existingBid.save();
                if (booking.status === 'finding_workers') {
                    booking.status = 'bids_received';
                    await booking.save();
                    (0, socket_1.notifyUser)(booking.customer.toString(), 'booking_status_updated', {
                        bookingId,
                        status: 'bids_received',
                    });
                }
                const worker = await Worker_1.default.findById(req.user.id).select('fullName rating profileImage');
                const customerId = booking.customer.toString();
                const bidPayload = { ...existingBid.toObject(), worker };
                (0, socket_1.notifyBookingRoom)(bookingId, 'booking:new-bid', {
                    bookingId,
                    bid: bidPayload,
                });
                (0, socket_1.notifyUser)(customerId, 'booking:new-bid', {
                    bookingId,
                    bid: bidPayload,
                });
                await (0, socket_1.sendNotification)({
                    recipientId: customerId,
                    recipientModel: 'User',
                    type: 'new_bid',
                    title: 'New Bid Received',
                    message: `${worker?.fullName} offered ₹${priceOffered} for your service request.`,
                    data: { bookingId },
                });
                res.status(200).json({ message: 'Bid re-submitted', bid: existingBid });
                return;
            }
            res.status(400).json({ message: 'You already bid on this booking' });
            return;
        }
        const bid = await WorkBid_1.default.create({
            booking: bookingId,
            worker: req.user.id,
            priceOffered,
            message: bidMessage,
        });
        if (booking.status === 'finding_workers') {
            booking.status = 'bids_received';
            await booking.save();
            (0, socket_1.notifyUser)(booking.customer.toString(), 'booking_status_updated', {
                bookingId,
                status: 'bids_received',
            });
        }
        // Real-time: Notify customer about new bid
        const worker = await Worker_1.default.findById(req.user.id).select('fullName rating profileImage');
        const customerId = booking.customer.toString();
        const bidPayload = { ...bid.toObject(), worker };
        (0, socket_1.notifyBookingRoom)(bookingId, 'booking:new-bid', {
            bookingId,
            bid: bidPayload,
        });
        (0, socket_1.notifyUser)(customerId, 'booking:new-bid', {
            bookingId,
            bid: bidPayload,
        });
        await (0, socket_1.sendNotification)({
            recipientId: customerId,
            recipientModel: 'User',
            type: 'new_bid',
            title: 'New Bid Received',
            message: `${worker?.fullName} offered ₹${priceOffered} for your service request.`,
            data: { bookingId },
        });
        res.status(201).json({ message: 'Bid submitted', bid });
    }
    catch (error) {
        logger_1.default.error('Submit bid error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.submitBid = submitBid;
// ─── Respond to Negotiation (Worker accepts / counters / declines) ───
const respondToNegotiation = async (req, res) => {
    try {
        const { id: bookingId, bidId } = req.params;
        const { action, amount, message } = req.body;
        if (!['accept', 'counter', 'decline'].includes(action)) {
            res.status(400).json({ message: 'action must be accept | counter | decline' });
            return;
        }
        const bid = await WorkBid_1.default.findOne({ _id: bidId, worker: req.user.id });
        if (!bid) {
            res.status(404).json({ message: 'Bid not found' });
            return;
        }
        if (bid.negotiationStatus !== 'customer_offered') {
            res.status(400).json({ message: 'No pending customer offer to respond to' });
            return;
        }
        const booking = await Booking_1.default.findOne({
            _id: bookingId,
            status: { $in: ['finding_workers', 'bids_received'] },
        });
        if (!booking) {
            res.status(400).json({ message: 'Booking no longer available for negotiation' });
            return;
        }
        if (action === 'accept') {
            const lastOffer = bid.negotiations[bid.negotiations.length - 1];
            bid.negotiationStatus = 'agreed';
            bid.agreedAmount = lastOffer.amount;
        }
        else if (action === 'counter') {
            if (!amount || Number(amount) <= 0) {
                res.status(400).json({ message: 'A valid counter amount is required' });
                return;
            }
            if (bid.negotiations.length >= 10) {
                res.status(400).json({ message: 'Maximum negotiation rounds reached' });
                return;
            }
            bid.negotiations.push({ by: 'worker', amount: Number(amount), message: message || '', createdAt: new Date() });
            bid.negotiationStatus = 'worker_offered';
        }
        else {
            bid.negotiationStatus = 'declined';
        }
        await bid.save();
        (0, socket_1.notifyUser)(booking.customer.toString(), 'booking:bid-negotiation', { bookingId, bid });
        res.json({ message: 'Response sent', bid });
    }
    catch (error) {
        logger_1.default.error('Respond to negotiation error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.respondToNegotiation = respondToNegotiation;
// ─── Approve Booking (Worker confirms to go) ───
const approveBooking = async (req, res) => {
    try {
        const booking = await Booking_1.default.findOne({
            _id: req.params.id,
            assignedWorker: req.user.id,
            status: 'worker_accepted',
        });
        if (!booking) {
            res.status(404).json({ message: 'Booking not found or not in correct state' });
            return;
        }
        // Scheduled booking: the worker cannot start before the customer's chosen time.
        if (booking.scheduledAt && Date.now() < new Date(booking.scheduledAt).getTime()) {
            res.status(403).json({
                message: 'This job is scheduled for a later time. You can start once the scheduled time arrives.',
                scheduledAt: booking.scheduledAt,
            });
            return;
        }
        // Check if worker already has an active job (approved/paid/in-progress).
        // A worker can only work on one job at a time.
        const activeJob = await Booking_1.default.findOne({
            assignedWorker: req.user.id,
            status: { $in: ['worker_approved', 'payment_done', 'in_progress'] },
            _id: { $ne: booking._id },
        });
        if (activeJob) {
            res.status(409).json({
                message: 'You already have an active job in progress. Complete it first before approving another.',
                activeBookingId: activeJob._id,
            });
            return;
        }
        booking.status = 'worker_approved';
        await booking.save();
        // Real-time: Notify customer that worker approved
        const customerId = booking.customer.toString();
        (0, socket_1.notifyUser)(customerId, 'booking_confirmed', {
            bookingId: booking._id,
            status: booking.status,
            message: 'Worker has approved the job. Please proceed to payment.',
        });
        (0, socket_1.notifyUser)(req.user.id, 'booking_confirmed', {
            bookingId: booking._id,
            status: booking.status,
            message: 'You approved this booking.',
        });
        await (0, socket_1.sendNotification)({
            recipientId: customerId,
            recipientModel: 'User',
            type: 'worker_approved',
            title: 'Worker Approved',
            message: 'The worker has approved your booking. Please proceed to payment.',
            data: { bookingId: booking._id },
        });
        res.json({ message: 'Booking approved. Customer will proceed to payment.', booking });
    }
    catch (error) {
        logger_1.default.error('Approve booking error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.approveBooking = approveBooking;
// ─── Reject Booking (Worker declines) ───
const rejectBooking = async (req, res) => {
    try {
        const booking = await Booking_1.default.findOne({
            _id: req.params.id,
            assignedWorker: req.user.id,
            status: 'worker_accepted',
        });
        if (!booking) {
            res.status(404).json({ message: 'Booking not found or not in correct state' });
            return;
        }
        // Reject the accepted worker's bid first.
        await WorkBid_1.default.findOneAndUpdate({ booking: booking._id, worker: req.user.id }, { status: 'rejected' });
        // Re-open previously rejected alternatives so customer is not stuck with no pending bids.
        await WorkBid_1.default.updateMany({
            booking: booking._id,
            worker: { $ne: req.user.id },
            status: 'rejected',
        }, { status: 'pending' });
        const hasPendingBids = await WorkBid_1.default.exists({ booking: booking._id, status: 'pending' });
        // Keep booking open in bids_received so workers can continue bidding even on older requests.
        booking.status = 'bids_received';
        booking.assignedWorker = undefined;
        booking.acceptedBid = undefined;
        booking.amount = 0;
        booking.paymentMethod = undefined;
        booking.paymentStatus = 'pending';
        booking.completionPin = undefined;
        booking.completionRequestedByWorkerAt = undefined;
        booking.completionCodeRevealedAt = undefined;
        await booking.save();
        const customerMessage = hasPendingBids
            ? 'Assigned worker rejected. Previous bids are available again.'
            : 'Assigned worker rejected. Booking reopened for fresh bids.';
        (0, socket_1.notifyUser)(booking.customer.toString(), 'booking_status_updated', {
            bookingId: booking._id,
            status: booking.status,
            message: customerMessage,
        });
        (0, socket_1.notifyUser)(req.user.id, 'booking_status_updated', {
            bookingId: booking._id,
            status: booking.status,
            message: 'You rejected this booking.',
        });
        res.json({ message: 'Booking rejected', booking });
    }
    catch (error) {
        logger_1.default.error('Reject booking error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.rejectBooking = rejectBooking;
// ─── Cancel Booking (Worker cancels before payment) ───
const cancelBookingByWorker = async (req, res) => {
    try {
        const { reason } = req.body;
        const booking = await Booking_1.default.findOne({
            _id: req.params.id,
            assignedWorker: req.user.id,
        });
        if (!booking) {
            res.status(404).json({ message: 'Booking not found' });
            return;
        }
        // Worker can only cancel before payment
        if (['payment_done', 'in_progress', 'completed', 'cancelled'].includes(booking.status)) {
            res.status(400).json({ message: 'Cannot cancel after payment has been made' });
            return;
        }
        booking.status = 'cancelled';
        booking.cancellation = {
            cancelledBy: 'worker',
            reason: reason || 'Worker cancelled',
            cancelledAt: new Date(),
        };
        await booking.save();
        void (0, bookingVoice_service_1.removeBookingVoiceNote)(booking);
        // Notify customer
        (0, socket_1.notifyUser)(booking.customer.toString(), 'booking_status_updated', {
            bookingId: booking._id,
            status: 'cancelled',
            reason: booking.cancellation.reason,
            cancelledBy: 'worker',
        });
        (0, socket_1.notifyUser)(req.user.id, 'booking_status_updated', {
            bookingId: booking._id,
            status: 'cancelled',
            reason: booking.cancellation.reason,
            cancelledBy: 'worker',
        });
        await (0, socket_1.sendNotification)({
            recipientId: booking.customer.toString(),
            recipientModel: 'User',
            type: 'booking_cancelled',
            title: 'Booking Cancelled by Worker',
            message: `The worker has cancelled the booking. Reason: ${booking.cancellation.reason}`,
            data: { bookingId: booking._id },
        });
        res.json({ message: 'Booking cancelled', booking });
    }
    catch (error) {
        logger_1.default.error('Worker cancel booking error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.cancelBookingByWorker = cancelBookingByWorker;
// ─── Send Message to Customer ───
const sendMessage = async (req, res) => {
    try {
        const { message } = req.body;
        const booking = await Booking_1.default.findOneAndUpdate({
            _id: req.params.id,
            assignedWorker: req.user.id,
            status: { $in: ['worker_approved', 'payment_done', 'in_progress'] },
        }, { workerMessage: message }, { new: true });
        if (!booking) {
            res.status(404).json({ message: 'Booking not found' });
            return;
        }
        // Real-time: Send ETA message to customer
        const customerId = booking.customer.toString();
        (0, socket_1.notifyUser)(customerId, 'worker:message', {
            bookingId: booking._id,
            message,
        });
        res.json({ message: 'Message sent to customer' });
    }
    catch (error) {
        logger_1.default.error('Send message error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.sendMessage = sendMessage;
// ─── Worker requests customer completion code ───
const requestCompletionCode = async (req, res) => {
    try {
        const booking = await Booking_1.default.findOne({
            _id: req.params.id,
            assignedWorker: req.user.id,
            status: { $in: ['payment_done', 'in_progress'] },
        });
        if (!booking) {
            res.status(404).json({ message: 'Booking not found' });
            return;
        }
        // Deliberately does NOT read completionPin — it is `select: false` and this
        // response is sent to the WORKER. The booking reaching this point is already
        // filtered to payment_done/in_progress, which is exactly when a PIN exists.
        if (!booking.completionRequestedByWorkerAt) {
            booking.completionRequestedByWorkerAt = new Date();
        }
        // Move to in-progress once worker explicitly marks work as completed/requesting final customer confirmation.
        if (booking.status === 'payment_done') {
            booking.status = 'in_progress';
        }
        await booking.save();
        const payload = {
            bookingId: booking._id,
            status: booking.status,
            completionCodeRequested: true,
            message: 'Worker marked the work as completed.',
        };
        const customerId = booking.customer.toString();
        (0, socket_1.notifyUser)(customerId, 'booking_status_updated', payload);
        (0, socket_1.notifyUser)(req.user.id, 'booking_status_updated', payload);
        await (0, socket_1.sendNotification)({
            recipientId: customerId,
            recipientModel: 'User',
            type: 'completion_code_requested',
            title: 'Work Completion Confirmation Needed',
            message: 'Your worker has marked the job as done. Share your completion code only once you are satisfied with the work.',
            data: { bookingId: booking._id },
        });
        res.json({
            message: 'Completion code request sent to customer',
            booking,
        });
    }
    catch (error) {
        logger_1.default.error('Request completion code error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.requestCompletionCode = requestCompletionCode;
// ─── Complete Work (with PIN) ───
const completeWork = async (req, res) => {
    try {
        const { pin } = req.body;
        const submittedPin = typeof pin === 'string' ? pin.trim() : '';
        // +completionPin: needed ONLY to compare against what the worker typed. The
        // booking is never echoed back to the worker with this field selected.
        const booking = await Booking_1.default.findOne({
            _id: req.params.id,
            assignedWorker: req.user.id,
            status: { $in: ['payment_done', 'in_progress'] },
        }).select('+completionPin');
        if (!booking) {
            res.status(404).json({ message: 'Booking not found' });
            return;
        }
        // The old flow required the worker to request a code and then the customer to
        // "reveal" it before this point. Both gates are gone: the customer receives the
        // code the moment their payment succeeds, so knowing the code IS the proof that
        // the customer handed it over. The PIN match is now the only gate.
        if (!booking.completionPin) {
            res.status(400).json({ message: 'Completion code is not available for this booking yet' });
            return;
        }
        if (booking.completionPin !== submittedPin) {
            res.status(400).json({ message: 'Invalid PIN' });
            return;
        }
        const isCashBooking = booking.paymentMethod === 'cash';
        // Atomically claim the completion transition. Only the request that flips the
        // status from payment_done/in_progress → completed proceeds to credit the
        // worker; a concurrent duplicate finds no matching booking and stops here,
        // so earnings can never be double-credited.
        const claimed = await Booking_1.default.findOneAndUpdate({
            _id: req.params.id,
            assignedWorker: req.user.id,
            status: { $in: ['payment_done', 'in_progress'] },
        }, { $set: { status: 'completed', ...(isCashBooking ? { paymentStatus: 'paid' } : {}) } }, { new: true });
        if (!claimed) {
            res.status(404).json({ message: 'Booking not found' });
            return;
        }
        void (0, bookingVoice_service_1.removeBookingVoiceNote)(claimed);
        // FREE platform — no commission, no dues. Worker keeps 100%.
        const workerEarning = claimed.amount;
        // Credit the worker and write the ledger rows atomically so a partial
        // failure can't leave a balance change without its Transaction record.
        const session = await mongoose_1.default.startSession();
        let newBalance = 0;
        try {
            await session.withTransaction(async () => {
                const inc = { totalWorkDone: 1, totalEarnings: workerEarning };
                // Cash: worker already collected in hand, nothing to add to balance.
                if (claimed.paymentMethod === 'online')
                    inc.balance = workerEarning;
                const updatedWorker = await Worker_1.default.findOneAndUpdate({ _id: req.user.id }, { $inc: inc }, { new: true, session });
                if (!updatedWorker) {
                    const notFound = new Error('WORKER_NOT_FOUND');
                    notFound.code = 'WORKER_NOT_FOUND';
                    throw notFound;
                }
                newBalance = updatedWorker.balance;
                if (isCashBooking) {
                    const existingCashPayment = await Transaction_1.default.findOne({
                        booking: claimed._id,
                        type: 'booking_payment',
                        method: 'cash',
                    }).session(session);
                    if (existingCashPayment) {
                        existingCashPayment.amount = claimed.amount;
                        existingCashPayment.status = 'completed';
                        existingCashPayment.user = claimed.customer;
                        existingCashPayment.worker = updatedWorker._id;
                        await existingCashPayment.save({ session });
                    }
                    else {
                        await Transaction_1.default.create([{
                                tid: (0, generateTID_1.generateTID)(),
                                booking: claimed._id,
                                user: claimed.customer,
                                worker: updatedWorker._id,
                                type: 'booking_payment',
                                amount: claimed.amount,
                                method: 'cash',
                                status: 'completed',
                            }], { session });
                    }
                }
                // Create earning transaction
                await Transaction_1.default.create([{
                        tid: (0, generateTID_1.generateTID)(),
                        booking: claimed._id,
                        user: claimed.customer,
                        worker: updatedWorker._id,
                        type: 'worker_earning',
                        amount: workerEarning,
                        method: claimed.paymentMethod,
                        status: 'completed',
                    }], { session });
            });
        }
        catch (err) {
            if (err.code === 'WORKER_NOT_FOUND') {
                res.status(404).json({ message: 'Worker not found' });
                return;
            }
            throw err;
        }
        finally {
            await session.endSession();
        }
        // Real-time: Notify customer that work is completed
        const customerId = claimed.customer.toString();
        const completionPayload = {
            bookingId: claimed._id,
            status: 'completed',
            paymentStatus: claimed.paymentStatus,
        };
        (0, socket_1.notifyUser)(customerId, 'booking_status_updated', completionPayload);
        (0, socket_1.notifyUser)(req.user.id, 'booking_status_updated', completionPayload);
        await (0, socket_1.sendNotification)({
            recipientId: customerId,
            recipientModel: 'User',
            type: 'work_completed',
            title: 'Work Completed!',
            message: 'The worker has completed the job. Please rate your experience.',
            data: { bookingId: claimed._id },
        });
        res.json({
            message: 'Work completed successfully!',
            earning: workerEarning,
            newBalance,
        });
    }
    catch (error) {
        logger_1.default.error('Complete work error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.completeWork = completeWork;
// ─── Get Funds ───
const getFunds = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.user.id);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        res.json({
            balance: worker.balance,
            totalEarnings: worker.totalEarnings,
            bankDetails: worker.bankDetails,
        });
    }
    catch (error) {
        logger_1.default.error('Get funds error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getFunds = getFunds;
// ─── Get Earnings History ───
const getEarningsHistory = async (req, res) => {
    try {
        const transactions = await Transaction_1.default.find({
            worker: req.user.id,
            type: 'worker_earning',
        })
            .populate('booking', 'workDescription')
            .sort({ createdAt: -1 });
        res.json({ transactions });
    }
    catch (error) {
        logger_1.default.error('Get earnings history error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getEarningsHistory = getEarningsHistory;
// ─── Get Wallet Transactions (full history) ───
const getWalletTransactions = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.user.id);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        // All transactions for this worker (exclude customer payment records)
        const transactions = await Transaction_1.default.find({ worker: req.user.id, type: { $ne: 'booking_payment' } })
            .populate({
            path: 'booking',
            select: 'workDescription category amount paymentMethod customer',
            populate: [
                { path: 'category', select: 'name' },
                { path: 'customer', select: 'fullName' },
            ],
        })
            .sort({ createdAt: -1 });
        // Withdrawals
        const withdrawals = await Withdrawal_1.default.find({ worker: req.user.id }).sort({ createdAt: -1 });
        // Summary
        const summary = await Transaction_1.default.aggregate([
            { $match: { worker: worker._id, status: 'completed' } },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ]);
        const earningsSummary = summary.find((s) => s._id === 'worker_earning');
        res.json({
            balance: worker.balance,
            totalEarnings: worker.totalEarnings,
            totalJobs: earningsSummary?.count || 0,
            transactions,
            withdrawals,
        });
    }
    catch (error) {
        logger_1.default.error('Get wallet transactions error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getWalletTransactions = getWalletTransactions;
// ─── Save Bank Details ───
const saveBankDetails = async (req, res) => {
    try {
        const { holderName, bankName, accountNumber, ifscCode } = req.body;
        const worker = await Worker_1.default.findByIdAndUpdate(req.user.id, { bankDetails: { holderName, bankName, accountNumber, ifscCode } }, { new: true });
        res.json({ message: 'Bank details saved', bankDetails: worker?.bankDetails });
    }
    catch (error) {
        logger_1.default.error('Save bank details error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.saveBankDetails = saveBankDetails;
// ─── Request Withdrawal ───
const requestWithdrawal = async (req, res) => {
    try {
        const { amount } = req.body;
        const worker = await Worker_1.default.findById(req.user.id);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        if (!worker.bankDetails?.holderName ||
            !worker.bankDetails?.bankName ||
            !worker.bankDetails?.accountNumber ||
            !worker.bankDetails?.ifscCode) {
            res.status(400).json({ message: 'Please complete bank details first' });
            return;
        }
        if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
            res.status(400).json({ message: 'Invalid amount' });
            return;
        }
        // Debit the balance and create the withdrawal atomically. The conditional
        // `balance: { $gte: amount }` update is the race guard: two concurrent
        // requests can never both pass, so a worker can't over-withdraw. The debit
        // and the ledger row are wrapped in a transaction so they both commit or
        // both roll back (no debit without a matching withdrawal record).
        const session = await mongoose_1.default.startSession();
        let withdrawal;
        let newBalance = worker.balance;
        try {
            await session.withTransaction(async () => {
                const debited = await Worker_1.default.findOneAndUpdate({ _id: req.user.id, balance: { $gte: amount } }, { $inc: { balance: -amount } }, { new: true, session });
                if (!debited) {
                    const insufficient = new Error('INSUFFICIENT_BALANCE');
                    insufficient.code = 'INSUFFICIENT_BALANCE';
                    throw insufficient;
                }
                const [created] = await Withdrawal_1.default.create([{ worker: debited._id, amount, bankDetails: worker.bankDetails }], { session });
                withdrawal = created;
                newBalance = debited.balance;
            });
        }
        catch (err) {
            if (err.code === 'INSUFFICIENT_BALANCE') {
                res.status(400).json({ message: 'Insufficient balance' });
                return;
            }
            throw err;
        }
        finally {
            await session.endSession();
        }
        (0, socket_1.notifyUser)(req.user.id, 'withdrawal_update', {
            withdrawalId: withdrawal._id,
            status: 'pending',
            withdrawal,
            balance: newBalance,
        });
        (0, socket_1.notifyRole)('admin', 'withdrawal_update', {
            withdrawalId: withdrawal._id,
            status: 'pending',
            withdrawal,
            workerId: worker._id,
        });
        // Persist notification for admins
        (0, socket_1.sendAdminNotification)({
            type: 'new_withdrawal',
            title: 'New Withdrawal Request',
            message: `Worker requested ₹${amount} withdrawal.`,
            data: { withdrawalId: withdrawal._id, workerId: worker._id },
        }).catch(() => { });
        res.status(201).json({
            message: 'Withdrawal request submitted. Will be processed within 3 hours.',
            withdrawal,
        });
    }
    catch (error) {
        logger_1.default.error('Request withdrawal error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.requestWithdrawal = requestWithdrawal;
// ─── Get Withdrawal History ───
const getWithdrawals = async (req, res) => {
    try {
        const withdrawals = await Withdrawal_1.default.find({ worker: req.user.id })
            .sort({ requestedAt: -1 });
        res.json({ withdrawals });
    }
    catch (error) {
        logger_1.default.error('Get withdrawals error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getWithdrawals = getWithdrawals;
// ─── Get Notifications ───
const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification_1.default.find({ recipient: req.user.id, recipientModel: 'Worker' })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json({ notifications });
    }
    catch (error) {
        logger_1.default.error('Get notifications error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getNotifications = getNotifications;
// ─── Mark Notification Read ───
const markNotificationRead = async (req, res) => {
    try {
        await Notification_1.default.findOneAndUpdate({ _id: req.params.id, recipient: req.user.id }, { isRead: true });
        // Push the fresh badge count only after the write succeeded (best-effort).
        void (0, socket_1.emitNotificationUnreadCount)(req.user.id, 'Worker');
        res.json({ message: 'Marked as read' });
    }
    catch (error) {
        logger_1.default.error('Mark notification read error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.markNotificationRead = markNotificationRead;
// ─── Mark All Notifications Read ───
const markAllNotificationsRead = async (req, res) => {
    try {
        await Notification_1.default.updateMany({ recipient: req.user.id, recipientModel: 'Worker', isRead: false }, { isRead: true });
        void (0, socket_1.emitNotificationUnreadCount)(req.user.id, 'Worker');
        res.json({ message: 'All marked as read' });
    }
    catch (error) {
        logger_1.default.error('Mark all read error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.markAllNotificationsRead = markAllNotificationsRead;
// ─── Delete Notification ───
const deleteNotification = async (req, res) => {
    try {
        await Notification_1.default.findOneAndDelete({ _id: req.params.id, recipient: req.user.id });
        void (0, socket_1.emitNotificationUnreadCount)(req.user.id, 'Worker');
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.deleteNotification = deleteNotification;
// ─── Get Chatbot QA ───
const getChatbotQA = async (req, res) => {
    try {
        const { category } = req.query;
        const query = {
            isActive: true,
            $or: [
                { targetAudience: { $in: ['all', 'worker'] } },
                { targetAudience: { $exists: false } },
            ],
        };
        if (category)
            query.category = category;
        const qas = await ChatbotQA_1.default.find(query).sort({ category: 1, order: 1 });
        const categories = await ChatbotQA_1.default.distinct('category', {
            isActive: true,
            $or: [
                { targetAudience: { $in: ['all', 'worker'] } },
                { targetAudience: { $exists: false } },
            ],
        });
        res.json({ qas, categories });
    }
    catch (error) {
        logger_1.default.error('Get chatbot QA error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getChatbotQA = getChatbotQA;
// ─── Create Help Ticket ───
const createHelpTicket = async (req, res) => {
    try {
        const { category, message, phoneNumber } = req.body;
        if (!category || !message) {
            res.status(400).json({ message: 'Category and message are required' });
            return;
        }
        const ticketNumber = await (0, ticketNumber_service_1.generateTicketNumber)();
        const ticket = await HelpTicket_1.default.create({
            ticketNumber,
            user: req.user.id,
            userModel: 'Worker',
            category,
            chatHistory: [
                { sender: 'user', message, timestamp: new Date() },
                {
                    sender: 'bot',
                    message: `Your ticket ${ticketNumber} has been created. Share this number for faster support.`,
                    timestamp: new Date(),
                },
            ],
            phoneNumber,
            status: 'open',
        });
        const ticketForAdmin = await HelpTicket_1.default.findById(ticket._id)
            .populate('user', 'fullName phone email');
        (0, socket_1.notifyUser)(req.user.id, 'help_ticket_updated', {
            action: 'created',
            ticket,
        });
        if (ticketForAdmin) {
            (0, socket_1.notifyRole)('admin', 'help_ticket_updated', {
                action: 'created',
                ticket: ticketForAdmin,
            });
        }
        // Persist notification for admins
        (0, socket_1.sendAdminNotification)({
            type: 'new_help_ticket',
            title: 'New Support Ticket',
            message: `Worker created ticket #${ticketNumber}: ${category}`,
            data: { ticketId: ticket._id },
        }).catch(() => { });
        res.status(201).json({ message: 'Ticket created', ticket });
    }
    catch (error) {
        logger_1.default.error('Create help ticket error:', { err: error });
        if (error &&
            typeof error === 'object' &&
            'name' in error &&
            error.name === 'ValidationError') {
            res.status(400).json({ message: 'Invalid ticket data', error: error.message });
            return;
        }
        res.status(500).json({ message: 'Server error' });
    }
};
exports.createHelpTicket = createHelpTicket;
// ─── Get My Help Tickets ───
const getHelpTickets = async (req, res) => {
    try {
        const { q, status } = req.query;
        const query = { user: req.user.id, userModel: 'Worker' };
        if (typeof status === 'string' && ['open', 'escalated', 'resolved'].includes(status)) {
            query.status = status;
        }
        if (typeof q === 'string' && q.trim()) {
            const pattern = new RegExp(escapeRegex(q.trim()), 'i');
            query.$or = [
                { ticketNumber: pattern },
                { category: pattern },
            ];
        }
        const tickets = await HelpTicket_1.default.find(query)
            .sort({ updatedAt: -1 });
        const baseSummaryQuery = { user: req.user.id, userModel: 'Worker' };
        const [totalTickets, openTickets, escalatedTickets, resolvedTickets] = await Promise.all([
            HelpTicket_1.default.countDocuments(baseSummaryQuery),
            HelpTicket_1.default.countDocuments({ ...baseSummaryQuery, status: 'open' }),
            HelpTicket_1.default.countDocuments({ ...baseSummaryQuery, status: 'escalated' }),
            HelpTicket_1.default.countDocuments({ ...baseSummaryQuery, status: 'resolved' }),
        ]);
        res.json({
            tickets,
            summary: {
                totalTickets,
                openTickets,
                escalatedTickets,
                resolvedTickets,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Get help tickets error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getHelpTickets = getHelpTickets;
// ─── Get Help Ticket Detail ───
const getHelpTicketDetail = async (req, res) => {
    try {
        const ticket = await HelpTicket_1.default.findOne({ _id: req.params.id, user: req.user.id });
        if (!ticket) {
            res.status(404).json({ message: 'Ticket not found' });
            return;
        }
        res.json({ ticket });
    }
    catch (error) {
        logger_1.default.error('Get ticket detail error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getHelpTicketDetail = getHelpTicketDetail;
// ─── Append Message to Help Ticket ───
const appendHelpTicketMessage = async (req, res) => {
    try {
        const { message } = req.body;
        const ticket = await HelpTicket_1.default.findOne({ _id: req.params.id, user: req.user.id });
        if (!ticket) {
            res.status(404).json({ message: 'Ticket not found' });
            return;
        }
        if (ticket.status === 'resolved') {
            res.status(400).json({ message: 'Cannot reply to a resolved ticket' });
            return;
        }
        ticket.chatHistory.push({ sender: 'user', message, timestamp: new Date() });
        await ticket.save();
        const ticketForAdmin = await HelpTicket_1.default.findById(ticket._id)
            .populate('user', 'fullName phone email');
        (0, socket_1.notifyUser)(req.user.id, 'help_ticket_updated', {
            action: 'message',
            ticket,
        });
        if (ticketForAdmin) {
            (0, socket_1.notifyRole)('admin', 'help_ticket_updated', {
                action: 'message',
                ticket: ticketForAdmin,
            });
        }
        res.json({ message: 'Message sent', ticket });
    }
    catch (error) {
        logger_1.default.error('Append help ticket message error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.appendHelpTicketMessage = appendHelpTicketMessage;
// ─── Escalate Help Ticket ───
const escalateHelpTicket = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        const ticket = await HelpTicket_1.default.findOne({ _id: req.params.id, user: req.user.id });
        if (!ticket) {
            res.status(404).json({ message: 'Ticket not found' });
            return;
        }
        ticket.status = 'escalated';
        if (phoneNumber)
            ticket.phoneNumber = phoneNumber;
        ticket.chatHistory.push({
            sender: 'bot',
            message: 'Your issue has been escalated. Our team will contact you within 24 hours.',
            timestamp: new Date(),
        });
        await ticket.save();
        const ticketForAdmin = await HelpTicket_1.default.findById(ticket._id)
            .populate('user', 'fullName phone email');
        (0, socket_1.notifyUser)(req.user.id, 'help_ticket_updated', {
            action: 'escalated',
            ticket,
        });
        if (ticketForAdmin) {
            (0, socket_1.notifyRole)('admin', 'help_ticket_updated', {
                action: 'escalated',
                ticket: ticketForAdmin,
            });
        }
        res.json({ message: 'Ticket escalated', ticket });
    }
    catch (error) {
        logger_1.default.error('Escalate help ticket error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.escalateHelpTicket = escalateHelpTicket;
// ───────────────────────────────────────────────────────────────
// Worker skill management (post-approval)
// ───────────────────────────────────────────────────────────────
// GET /worker/skills — current skills + edit eligibility
const getSkills = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.user.id).populate('skills.category', 'name image');
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        res.json({
            skills: worker.skills || [],
            accountAgeMonths: (0, workerSkills_1.accountAgeMonths)(worker.createdAt),
            maxExperienceBumps: (0, workerSkills_1.maxExperienceBumps)(worker.createdAt),
            canEditExperience: (0, workerSkills_1.accountAgeMonths)(worker.createdAt) >= 6,
        });
    }
    catch (error) {
        logger_1.default.error('Get skills error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getSkills = getSkills;
// POST /worker/skills/request — add a NEW skill (goes to admin review)
const requestSkill = async (req, res) => {
    try {
        const categoryId = typeof req.body?.categoryId === 'string' ? req.body.categoryId : '';
        const experienceYears = Math.max(0, Math.min(60, Number(req.body?.experienceYears) || 0));
        const confirmed = req.body?.confirmed === true || req.body?.confirmed === 'true';
        if (!categoryId) {
            res.status(400).json({ message: 'Category is required' });
            return;
        }
        if (!confirmed) {
            res.status(400).json({ message: 'Please confirm you can do this work' });
            return;
        }
        const category = await Category_1.default.findById(categoryId).select('_id name');
        if (!category) {
            res.status(404).json({ message: 'Category not found' });
            return;
        }
        const worker = await Worker_1.default.findById(req.user.id);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        const existing = (worker.skills || []).find((s) => String(s.category) === categoryId);
        if (existing && existing.status !== 'rejected') {
            res.status(400).json({ message: existing.status === 'pending_review' ? 'This skill is already under review' : 'You already have this skill' });
            return;
        }
        if (existing) {
            // Re-applying a previously removed/rejected skill → full process again.
            existing.experienceYears = experienceYears;
            existing.confirmed = confirmed;
            existing.status = 'pending_review';
            existing.experienceBumpsUsed = 0;
            existing.callAttempts = 0;
            existing.rejectionReason = '';
            existing.requestedAt = new Date();
            existing.decidedAt = null;
        }
        else {
            worker.skills = worker.skills || [];
            worker.skills.push({
                category: category._id, experienceYears, confirmed, status: 'pending_review',
                experienceBumpsUsed: 0, callAttempts: 0, requestedAt: new Date(), decidedAt: null,
            });
        }
        await worker.save();
        await (0, socket_1.sendAdminNotification)({
            type: 'skill_request',
            title: 'Worker Skill Request',
            message: `${worker.fullName} requested to add "${category.name}" (${experienceYears} yr exp). Verify on a call.`,
            data: { workerId: String(worker._id) },
        }).catch(() => { });
        res.status(201).json({ message: 'Skill request submitted for review. Our team will verify on a call.' });
    }
    catch (error) {
        logger_1.default.error('Request skill error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.requestSkill = requestSkill;
// POST /worker/skills/:skillId/bump-experience — +6 months (gated by account age)
const bumpSkillExperience = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.user.id);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        const skill = (worker.skills || []).find((s) => String(s._id) === req.params.skillId);
        if (!skill || skill.status !== 'approved') {
            res.status(400).json({ message: 'Skill not found or not approved' });
            return;
        }
        const allowed = (0, workerSkills_1.maxExperienceBumps)(worker.createdAt);
        if ((0, workerSkills_1.accountAgeMonths)(worker.createdAt) < 6) {
            res.status(400).json({ message: 'Experience can be updated only after 6 months on Fixo.' });
            return;
        }
        if (skill.experienceBumpsUsed >= allowed) {
            res.status(400).json({ message: 'No experience update available yet. You can add +6 months for every 6 months on Fixo.' });
            return;
        }
        skill.experienceYears = Math.round((skill.experienceYears + 0.5) * 10) / 10;
        skill.experienceBumpsUsed += 1;
        await worker.save();
        res.json({ message: 'Experience updated (+6 months)', experienceYears: skill.experienceYears });
    }
    catch (error) {
        logger_1.default.error('Bump experience error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.bumpSkillExperience = bumpSkillExperience;
// POST /worker/skills/:skillId/unselect — remove a skill (re-adding restarts review)
const unselectSkill = async (req, res) => {
    try {
        const worker = await Worker_1.default.findById(req.user.id);
        if (!worker) {
            res.status(404).json({ message: 'Worker not found' });
            return;
        }
        const before = (worker.skills || []).length;
        const filtered = (worker.skills || []).filter((s) => String(s._id) !== req.params.skillId);
        if (filtered.length === before) {
            res.status(404).json({ message: 'Skill not found' });
            return;
        }
        worker.skills = filtered;
        (0, workerSkills_1.syncCategoriesFromSkills)(worker);
        await worker.save();
        res.json({ message: 'Skill removed. To add it again you will go through verification.' });
    }
    catch (error) {
        logger_1.default.error('Unselect skill error:', { err: error });
        res.status(500).json({ message: 'Server error' });
    }
};
exports.unselectSkill = unselectSkill;
//# sourceMappingURL=worker.controller.js.map