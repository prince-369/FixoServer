import { describe, it, expect } from 'vitest';
import { cldUrl, cldPreset } from './cloudinaryUrl';

const BASE = 'https://res.cloudinary.com/demo/image/upload/v1699999999/fixo/categories/abc123.jpg';

describe('cldUrl()', () => {
  it('inserts f_auto,q_auto and sizing into a plain delivery URL', () => {
    const out = cldUrl(BASE, { width: 400, height: 300, crop: 'fill', gravity: 'auto' });
    expect(out).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,g_auto,w_400,h_300/v1699999999/fixo/categories/abc123.jpg'
    );
  });

  it('defaults to f_auto,q_auto when no options given', () => {
    expect(cldUrl(BASE)).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1699999999/fixo/categories/abc123.jpg'
    );
  });

  it('does NOT double-transform an already-transformed URL', () => {
    const already = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_400/v1/fixo/x.jpg';
    expect(cldUrl(already, { width: 800 })).toBe(already);
  });

  it('works for video delivery URLs (voice notes)', () => {
    const v = 'https://res.cloudinary.com/demo/video/upload/v1/fixo/booking-voice/note.webm';
    expect(cldUrl(v, { quality: 'auto' })).toBe(
      'https://res.cloudinary.com/demo/video/upload/f_auto,q_auto/v1/fixo/booking-voice/note.webm'
    );
  });

  it('returns empty / nullish values unchanged', () => {
    expect(cldUrl('')).toBe('');
    expect(cldUrl(null)).toBe('');
    expect(cldUrl(undefined)).toBe('');
  });

  it('returns non-cloudinary URLs unchanged', () => {
    const google = 'https://lh3.googleusercontent.com/a/abc=s96-c';
    expect(cldUrl(google, { width: 200 })).toBe(google);
    const other = 'https://example.com/image/upload/x.jpg';
    expect(cldUrl(other, { width: 200 })).toBe(other);
  });

  it('returns data:, blob: and relative URLs unchanged', () => {
    expect(cldUrl('data:image/png;base64,AAAA', { width: 10 })).toBe('data:image/png;base64,AAAA');
    expect(cldUrl('blob:http://x/y', { width: 10 })).toBe('blob:http://x/y');
    expect(cldUrl('/local/pic.png', { width: 10 })).toBe('/local/pic.png');
  });

  it('omits quality/format when explicitly disabled with null', () => {
    const out = cldUrl(BASE, { width: 100, quality: null, format: null });
    expect(out).toBe(
      'https://res.cloudinary.com/demo/image/upload/w_100/v1699999999/fixo/categories/abc123.jpg'
    );
  });

  it('supports dpr', () => {
    const out = cldUrl(BASE, { width: 100, dpr: 2, quality: null, format: null });
    expect(out).toContain('w_100,dpr_2');
  });

  it('presets produce transformed URLs', () => {
    expect(cldPreset.category(BASE)).toContain('/upload/f_auto,q_auto,c_fill,g_auto,w_400,h_300/');
    expect(cldPreset.avatar(BASE, 150)).toContain('g_auto,w_150,h_150');
    expect(cldPreset.thumb(BASE)).toContain('w_96,h_96');
    expect(cldPreset.banner(BASE)).toContain('c_limit,w_1000');
    expect(cldPreset.category(null)).toBe('');
  });

  // ── Phase 7 URL-shape coverage ──
  it('preserves the version segment (transform inserted before v123)', () => {
    const out = cldUrl(BASE, { width: 400 });
    expect(out).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_400/v1699999999/fixo/categories/abc123.jpg'
    );
  });

  it('handles a deep nested folder path', () => {
    const nested = 'https://res.cloudinary.com/demo/image/upload/v1/fixo/a/b/c/pic.png';
    expect(cldUrl(nested, { width: 200 })).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_200/v1/fixo/a/b/c/pic.png'
    );
  });

  it('preserves a trailing query string', () => {
    const q = 'https://res.cloudinary.com/demo/image/upload/v1/fixo/x.jpg?_a=BAVABC&t=1';
    expect(cldUrl(q, { width: 200 })).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_200/v1/fixo/x.jpg?_a=BAVABC&t=1'
    );
  });

  it('preserves special characters (spaces, parens) in the path', () => {
    const special = 'https://res.cloudinary.com/demo/image/upload/v1/fixo/My%20Folder/pic%20(1).png';
    expect(cldUrl(special, { width: 128 })).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_128/v1/fixo/My%20Folder/pic%20(1).png'
    );
  });

  it('leaves a raw/upload URL matchable but is never fed one by image presets (caller-gated)', () => {
    // The helper is generic (supports image/video/raw); Phase 7 call sites only ever pass
    // image URLs. Documented here so the behavior is explicit.
    const raw = 'https://res.cloudinary.com/demo/raw/upload/v1/fixo/docs/report.pdf';
    expect(cldUrl(raw, { width: 200 })).toBe(
      'https://res.cloudinary.com/demo/raw/upload/f_auto,q_auto,w_200/v1/fixo/docs/report.pdf'
    );
  });

  it('does NOT transform a signed delivery URL (would invalidate the signature)', () => {
    const signed = 'https://res.cloudinary.com/demo/image/upload/s--Ab12Cd34--/v1/fixo/x.jpg';
    expect(cldUrl(signed, { width: 400 })).toBe(signed);
  });

  it('does NOT transform an authenticated/private delivery URL', () => {
    const authed = 'https://res.cloudinary.com/demo/image/authenticated/s--Ab12--/v1/fixo/x.jpg';
    const priv = 'https://res.cloudinary.com/demo/image/private/v1/fixo/x.jpg';
    expect(cldUrl(authed, { width: 400 })).toBe(authed);
    expect(cldUrl(priv, { width: 400 })).toBe(priv);
  });
});
