import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Integration test for the wallet withdrawal race (finding #1). Proves that two
// concurrent full-balance withdrawals can never BOTH succeed.
//
// Requires a MongoDB REPLICA SET (transactions are used) — point MONGODB_TEST_URI
// at one to run it, e.g. a mongodb-memory-server replset or a disposable Atlas DB.
// When unset it skips cleanly so the default suite stays green.
const TEST_DB = process.env.MONGODB_TEST_URI;
const describeIfDb = TEST_DB ? describe : describe.skip;

interface CapturingRes {
  statusCode: number;
  body: unknown;
}

const makeRes = (): { res: Response; captured: CapturingRes } => {
  const captured: CapturingRes = { statusCode: 200, body: undefined };
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      captured.body = payload;
      return this;
    },
  } as unknown as Response;
  return { res, captured };
};

describeIfDb('requestWithdrawal — concurrency (race #1)', () => {
  let Worker: typeof import('../models/Worker').default;
  let Withdrawal: typeof import('../models/Withdrawal').default;
  let requestWithdrawal: typeof import('./worker.controller').requestWithdrawal;
  let workerId = '';

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret';
    await mongoose.connect(TEST_DB as string);
    Worker = (await import('../models/Worker')).default;
    Withdrawal = (await import('../models/Withdrawal')).default;
    ({ requestWithdrawal } = await import('./worker.controller'));
  });

  afterAll(async () => {
    if (workerId) {
      await Worker.deleteOne({ _id: workerId });
      await Withdrawal.deleteMany({ worker: workerId });
    }
    await mongoose.disconnect();
  });

  it('two concurrent ₹1000 withdrawals on a ₹1000 balance → exactly one succeeds', async () => {
    const worker = await Worker.create({
      fullName: 'Race Worker',
      phone: `9${Date.now().toString().slice(-9)}`,
      aadhaarFront: 'x',
      aadhaarBack: 'y',
      balance: 1000,
      bankDetails: { holderName: 'A', bankName: 'B', accountNumber: '123456', ifscCode: 'IFSC0001' },
    });
    workerId = String(worker._id);

    const buildReq = () =>
      ({ user: { id: workerId, role: 'worker' }, body: { amount: 1000 } } as unknown as Request);

    const a = makeRes();
    const b = makeRes();
    await Promise.all([requestWithdrawal(buildReq(), a.res), requestWithdrawal(buildReq(), b.res)]);

    const statuses = [a.captured.statusCode, b.captured.statusCode].sort();
    expect(statuses).toEqual([201, 400]); // one success, one insufficient — never both 201

    const after = await Worker.findById(workerId);
    expect(after?.balance).toBe(0); // never negative, never double-withdrawn

    const withdrawals = await Withdrawal.countDocuments({ worker: workerId });
    expect(withdrawals).toBe(1);
  });
});
