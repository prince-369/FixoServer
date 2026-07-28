/**
 * Cloudinary delivery-URL transformation helper.
 *
 * Rewrites a *stored* Cloudinary delivery URL to request an optimized, resized variant
 * at delivery time. It NEVER mutates the original asset — the transformation is applied
 * on the fly by Cloudinary from the URL. The value stored in the database stays as-is.
 *
 * Pure string manipulation, so it works identically in Node, browser and React Native.
 *
 * Safety rules:
 *   - Only rewrites genuine Cloudinary delivery URLs (res.cloudinary.com / *.cloudinary.com
 *     with an `/<resource>/upload/` segment). Everything else is returned unchanged:
 *     empty/nullish values, data: URLs, blob: URLs, local/relative paths, other hosts.
 *   - If the URL already carries a transformation right after `/upload/`, it is returned
 *     unchanged (we never stack a second transformation).
 */
export interface CldTransform {
    width?: number;
    height?: number;
    /** Crop mode, e.g. 'fill' | 'fit' | 'thumb' | 'scale' | 'limit'. */
    crop?: string;
    /** Gravity, e.g. 'auto' | 'face' | 'center'. */
    gravity?: string;
    /** Quality; defaults to 'auto'. Pass null to omit. */
    quality?: string | number | null;
    /** Format; defaults to 'auto'. Pass null to omit. */
    format?: string | null;
    /** Device pixel ratio, e.g. 2 or 'auto'. */
    dpr?: string | number;
}
/**
 * Return `url` rewritten to include the given delivery transformation. Any URL that is
 * not a transformable Cloudinary delivery URL (or is already transformed) is returned
 * exactly as received.
 */
export declare const cldUrl: (url: string | null | undefined, transform?: CldTransform) => string;
export declare const cldPreset: {
    /** Square-ish category / service card image. */
    category: (url?: string | null) => string;
    /** Round profile / avatar image. Uses g_auto (safe for non-face profile pictures). */
    avatar: (url?: string | null, size?: number) => string;
    /** Small list thumbnail. */
    thumb: (url?: string | null, size?: number) => string;
    /** Wide promotional banner. */
    banner: (url?: string | null, width?: number) => string;
};
export default cldUrl;
//# sourceMappingURL=cloudinaryUrl.d.ts.map