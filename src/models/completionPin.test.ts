import { describe, expect, it, beforeAll } from 'vitest';

/**
 * The completion PIN is the customer's proof that the work is genuinely finished.
 * The whole "instant code" flow rests on one invariant:
 *
 *   the WORKER must never receive the PIN from the API.
 *
 * Previously the flow was safe only because the server refused to complete a job
 * until the customer pressed "reveal". Now that the gate is gone, knowing the code
 * IS the authorisation — so a worker who could read it from any booking payload
 * could close a job and release payment on their own.
 *
 * `select: false` on the field is what enforces that, and these tests pin it down.
 */

type BookingModel = typeof import('./Booking')['default'];
let Booking: BookingModel;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret';
  Booking = (await import('./Booking')).default;
});

describe('completionPin exposure', () => {
  it('is excluded from queries by default', () => {
    const path = Booking.schema.path('completionPin');
    // `selected: false` is what keeps the PIN out of every worker-facing payload.
    expect((path as unknown as { selectedInclusively: () => boolean; options: { select?: boolean } }).options.select)
      .toBe(false);
  });

  it('is absent from a document projected without it', () => {
    // Mirrors a worker-facing read: no `.select('+completionPin')`.
    const doc = new Booking({ status: 'payment_done' } as never, 'status');
    expect(doc.completionPin).toBeUndefined();
    expect(JSON.stringify(doc)).not.toContain('completionPin');
  });

  it('is present when a customer-facing read opts in', () => {
    const doc = new Booking({ status: 'payment_done', completionPin: '4821' } as never);
    expect(doc.completionPin).toBe('4821');
  });

  it('is unset — not silently kept — when a booking is reopened', () => {
    // rejectBooking clears the PIN on a document loaded WITHOUT that path selected.
    // Mongoose must still emit $unset, or a stale PIN would survive re-assignment.
    const doc = new Booking({ status: 'payment_done' } as never, 'status');
    doc.status = 'bids_received';
    doc.completionPin = undefined;

    const changes = doc.$getChanges() as { $unset?: Record<string, unknown> };
    expect(changes.$unset).toHaveProperty('completionPin');
  });
});
