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
/**
 * Strict, side-aware validation used by the live scanner and manual upload check.
 */
export declare const validateAadhaarSide: (buffer: Buffer, expectedSide: AadhaarSide) => Promise<AadhaarValidationResult>;
/**
 * Loose check used as a final server-side guard when saving: rejects anything
 * that clearly isn't an Aadhaar, without being strict about which side.
 */
export declare const looksLikeAadhaar: (buffer: Buffer) => Promise<boolean>;
/** OCR an image and return the printed details (name / dob / number). */
export declare const extractAadhaarFromImage: (buffer: Buffer) => Promise<AadhaarDetails>;
/** One-pass: does it look like an Aadhaar + what details are on it. */
export declare const inspectAadhaar: (buffer: Buffer) => Promise<{
    looksAadhaar: boolean;
    details: AadhaarDetails;
}>;
/** Normalise the digits out of a formatted/raw Aadhaar number string. */
export declare const normaliseAadhaarDigits: (value: string) => string;
/** One-way hash of the 12-digit Aadhaar number — used for duplicate detection. */
export declare const hashAadhaarNumber: (value: string) => string;
//# sourceMappingURL=aadhaarValidation.service.d.ts.map