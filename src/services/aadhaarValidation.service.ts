import crypto from 'crypto';
import { createWorker, type Worker } from 'tesseract.js';
import { isValidAadhaarNumber } from '../utils/verhoeff';

// ─────────────────────────────────────────────────────────────────────────────
// Aadhaar card validation. We OCR the image and combine several signals so a
// non-Aadhaar document is rejected and each side is detected correctly:
//   1. A 12-digit number that passes the Verhoeff checksum (strong Aadhaar signal)
//   2. Front keywords (Government of India / DOB / Gender …)
//   3. Back keywords (Unique Identification Authority of India / Address …)
// This is a high-accuracy heuristic — not a UIDAI-grade guarantee.
// ─────────────────────────────────────────────────────────────────────────────

export type AadhaarSide = 'front' | 'back';

export interface AadhaarDetails {
  name?: string;
  dob?: string;
  aadhaarNumber?: string;
}

export interface AadhaarValidationResult {
  valid: boolean;
  side: AadhaarSide | 'unknown';
  reason: string;
  numberDetected: boolean;
  details?: AadhaarDetails;
}

const FRONT_KEYWORDS = [
  'government of india', 'govt of india', 'date of birth', 'dob', 'year of birth',
  'male', 'female', 'transgender', 'भारत सरकार',
];
// Back-only signals. NOTE: keep these unambiguous — e.g. 'vid' was removed because
// newer Aadhaar FRONTs also print "VID:", which caused a front to match as back.
const BACK_KEYWORDS = [
  'unique identification', 'identification authority', 'authority of india',
  'help@uidai', 'www.uidai', 'uidai.gov.in', 'address',
];
const AADHAAR_HINTS = ['aadhaar', 'aadhar', 'uidai', 'भारत', 'भारत सरकार'];

// Tesseract worker is expensive to spin up — keep a single shared instance.
let workerPromise: Promise<Worker> | null = null;
const getWorker = (): Promise<Worker> => {
  if (!workerPromise) {
    workerPromise = createWorker('eng').catch((err) => {
      workerPromise = null; // allow retry on next call
      throw err;
    });
  }
  return workerPromise;
};

const extractText = async (buffer: Buffer): Promise<string> => {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);
  return data?.text || '';
};

// Find any 12-digit group (spaces allowed) that passes the Verhoeff checksum.
const hasVerhoeffValidNumber = (raw: string): boolean => {
  const candidates = raw.match(/[2-9]\d{3}\s?\d{4}\s?\d{4}/g) || [];
  return candidates.some((c) => isValidAadhaarNumber(c));
};

const analyse = (raw: string) => {
  const text = raw.toLowerCase();
  const numberDetected = hasVerhoeffValidNumber(raw);
  const hasFront = FRONT_KEYWORDS.some((k) => text.includes(k));
  const hasBack = BACK_KEYWORDS.some((k) => text.includes(k));
  const hasHint = AADHAAR_HINTS.some((k) => text.includes(k));
  const looksAadhaar = numberDetected || hasFront || hasBack || hasHint;
  return { numberDetected, hasFront, hasBack, looksAadhaar };
};

// ── Best-effort extraction of the details printed on the card (for user confirmation) ──
const extractAadhaarNumber = (raw: string): string | undefined => {
  const candidates = raw.match(/[2-9]\d{3}\s?\d{4}\s?\d{4}/g) || [];
  for (const c of candidates) {
    const digits = c.replace(/\D/g, '');
    if (isValidAadhaarNumber(digits)) {
      return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`;
    }
  }
  return undefined;
};

const extractDob = (raw: string): string | undefined => {
  const labelled = raw.match(/(?:dob|date of birth|d\.o\.b|जन्म)\s*[:\-]?\s*(\d{2}[/\-.]\d{2}[/\-.]\d{4})/i);
  if (labelled) return labelled[1].replace(/[.\-]/g, '/');
  const anyDate = raw.match(/\b(\d{2}[/\-.]\d{2}[/\-.]\d{4})\b/);
  if (anyDate) return anyDate[1].replace(/[.\-]/g, '/');
  const yob = raw.match(/(?:year of birth|yob)\s*[:\-]?\s*(\d{4})/i);
  if (yob) return yob[1];
  return undefined;
};

const extractName = (raw: string): string | undefined => {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

  // The English name sits on the line just above the DOB line. Search upward from
  // there first, then fall back to the rest of the card. Target the DOB *label*
  // (not any date) so the "Issue Date" line can't hijack the anchor.
  let dobIdx = lines.findIndex((l) => /\bdob\b|date of birth|year of birth|yob|जन्म/i.test(l));
  if (dobIdx < 0) dobIdx = lines.findIndex((l) => /\d{2}[/\-.]\d{2}[/\-.]\d{4}/.test(l) && !/issue/i.test(l));
  const order: number[] = [];
  if (dobIdx > 0) for (let i = dobIdx - 1; i >= 0; i--) order.push(i);
  for (let i = 0; i < lines.length; i++) if (!order.includes(i)) order.push(i);

  const bad = /government|india|aadhaar|aadhar|uidai|male|female|birth|issue|date|father|address|dob/i;
  // A genuine printed name is Title Case Latin: "Prince Kumar", "A K Sharma" is
  // excluded on purpose (all-caps / mixed garbage like "am PTR" won't match).
  const nameRe = /^[A-Z][a-z]+(?:\s[A-Z][a-z]+){0,3}$/;

  for (const i of order) {
    const l = lines[i].replace(/\s+/g, ' ').trim();
    if (bad.test(l)) continue;
    if (nameRe.test(l)) return l;
  }
  return undefined;
};

const extractDetails = (raw: string): AadhaarDetails => {
  const details: AadhaarDetails = {};
  const number = extractAadhaarNumber(raw);
  const dob = extractDob(raw);
  const name = extractName(raw);
  if (number) details.aadhaarNumber = number;
  if (dob) details.dob = dob;
  if (name) details.name = name;
  return details;
};

/**
 * Strict, side-aware validation used by the live scanner and manual upload check.
 */
export const validateAadhaarSide = async (
  buffer: Buffer,
  expectedSide: AadhaarSide
): Promise<AadhaarValidationResult> => {
  let raw = '';
  try {
    raw = await extractText(buffer);
  } catch {
    return { valid: false, side: 'unknown', reason: 'Could not read the image. Please try again.', numberDetected: false };
  }

  const { numberDetected, hasFront, hasBack, looksAadhaar } = analyse(raw);
  const details = extractDetails(raw);

  if (!looksAadhaar) {
    return {
      valid: false,
      side: 'unknown',
      reason: 'This does not look like an Aadhaar card. Please scan a valid Aadhaar.',
      numberDetected: false,
    };
  }

  if (expectedSide === 'front') {
    if (numberDetected && (hasFront || !hasBack)) {
      return { valid: true, side: 'front', reason: 'Valid Aadhaar front detected.', numberDetected: true, details };
    }
    if (hasBack && !hasFront) {
      return { valid: false, side: 'back', reason: 'This looks like the BACK side. Please scan the FRONT.', numberDetected };
    }
    return {
      valid: false,
      side: 'unknown',
      reason: numberDetected
        ? 'Hold the card steady inside the box.'
        : 'Aadhaar number not clear — move closer and use good light.',
      numberDetected,
    };
  }

  // expectedSide === 'back'
  if (hasBack) {
    return { valid: true, side: 'back', reason: 'Valid Aadhaar back detected.', numberDetected, details };
  }
  if (hasFront && numberDetected) {
    return { valid: false, side: 'front', reason: 'This looks like the FRONT side. Please scan the BACK.', numberDetected };
  }
  return {
    valid: false,
    side: 'unknown',
    reason: 'Back side not clear — show the address side inside the box.',
    numberDetected,
  };
};

/**
 * Loose check used as a final server-side guard when saving: rejects anything
 * that clearly isn't an Aadhaar, without being strict about which side.
 */
export const looksLikeAadhaar = async (buffer: Buffer): Promise<boolean> => {
  try {
    const raw = await extractText(buffer);
    return analyse(raw).looksAadhaar;
  } catch {
    // If OCR fails we don't hard-block saving (avoid false negatives on submit).
    return true;
  }
};

/** OCR an image and return the printed details (name / dob / number). */
export const extractAadhaarFromImage = async (buffer: Buffer): Promise<AadhaarDetails> => {
  try {
    return extractDetails(await extractText(buffer));
  } catch {
    return {};
  }
};

/** One-pass: does it look like an Aadhaar + what details are on it. */
export const inspectAadhaar = async (buffer: Buffer): Promise<{ looksAadhaar: boolean; details: AadhaarDetails }> => {
  try {
    const raw = await extractText(buffer);
    return { looksAadhaar: analyse(raw).looksAadhaar, details: extractDetails(raw) };
  } catch {
    return { looksAadhaar: true, details: {} };
  }
};

/** Normalise the digits out of a formatted/raw Aadhaar number string. */
export const normaliseAadhaarDigits = (value: string): string => (value || '').replace(/\D/g, '');

/** One-way hash of the 12-digit Aadhaar number — used for duplicate detection. */
export const hashAadhaarNumber = (value: string): string =>
  crypto.createHash('sha256').update(normaliseAadhaarDigits(value)).digest('hex');
