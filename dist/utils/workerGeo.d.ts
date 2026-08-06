/**
 * One definition of "where a worker actually is".
 *
 * A worker has two positions: `location` (the address they registered with — usually home)
 * and `currentLocation` (the live position their app reports as they move around). The
 * effective position is **`currentLocation ?? location`**: once a worker reports a live
 * position, that is where they are, and the registered address stops being relevant.
 *
 * This lived in three places that disagreed, which is how a worker standing next to the
 * customer could be invisible to that customer:
 *
 *   - job matching  →  currentLocation ?? location   (correct)
 *   - booking-page availability count  →  location only   (missed anyone away from home)
 *   - service availability check  →  currentLocation OR location   (counted workers twice
 *     over, so someone who had travelled away still showed as available at home)
 *
 * Everything now derives its filter from here so the number a customer is shown is exactly
 * the number of workers who would actually be notified.
 */
/** WGS-84 equatorial radius, matching what `$centerSphere` expects for radian conversion. */
export declare const EARTH_RADIUS_METERS = 6378137;
export declare const hasValidCoordinates: (coordinates: unknown) => coordinates is [number, number];
/**
 * A Mongo filter matching workers whose *effective* position is inside `radiusMeters`.
 *
 * Uses `$geoWithin`/`$centerSphere` rather than `$nearSphere` because only the former is
 * legal inside `$or` — which is what lets a single query express "the live position if there
 * is one, otherwise the registered one". Unlike `$nearSphere` this returns no distance
 * ordering, which callers that only count don't need.
 *
 * The two branches are mutually exclusive, so a worker is matched at most once and the result
 * is safe to `countDocuments()` directly.
 */
export declare const effectiveLocationWithin: (coordinates: [number, number], radiusMeters: number) => Record<string, unknown>;
/**
 * The in-JS counterpart of {@link effectiveLocationWithin}, for the manual-scan fallback that
 * runs when the geo index is unavailable. Kept beside it so the two cannot drift apart.
 */
export declare const effectiveWorkerCoordinates: (worker: {
    currentLocation?: {
        coordinates?: unknown;
    } | null;
    location?: {
        coordinates?: unknown;
    } | null;
}) => [number, number] | null;
//# sourceMappingURL=workerGeo.d.ts.map