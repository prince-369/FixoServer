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
const mongoose_1 = __importDefault(require("mongoose"));
const vitest_1 = require("vitest");
// Integration test for the wallet withdrawal race (finding #1). Proves that two
// concurrent full-balance withdrawals can never BOTH succeed.
//
// Requires a MongoDB REPLICA SET (transactions are used) — point MONGODB_TEST_URI
// at one to run it, e.g. a mongodb-memory-server replset or a disposable Atlas DB.
// When unset it skips cleanly so the default suite stays green.
const TEST_DB = process.env.MONGODB_TEST_URI;
const describeIfDb = TEST_DB ? vitest_1.describe : vitest_1.describe.skip;
const makeRes = () => {
    const captured = { statusCode: 200, body: undefined };
    const res = {
        status(code) {
            captured.statusCode = code;
            return this;
        },
        json(payload) {
            captured.body = payload;
            return this;
        },
    };
    return { res, captured };
};
describeIfDb('requestWithdrawal — concurrency (race #1)', () => {
    let Worker;
    let Withdrawal;
    let requestWithdrawal;
    let workerId = '';
    (0, vitest_1.beforeAll)(async () => {
        process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret';
        await mongoose_1.default.connect(TEST_DB);
        Worker = (await Promise.resolve().then(() => __importStar(require('../models/Worker')))).default;
        Withdrawal = (await Promise.resolve().then(() => __importStar(require('../models/Withdrawal')))).default;
        ({ requestWithdrawal } = await Promise.resolve().then(() => __importStar(require('./worker.controller'))));
    });
    (0, vitest_1.afterAll)(async () => {
        if (workerId) {
            await Worker.deleteOne({ _id: workerId });
            await Withdrawal.deleteMany({ worker: workerId });
        }
        await mongoose_1.default.disconnect();
    });
    (0, vitest_1.it)('two concurrent ₹1000 withdrawals on a ₹1000 balance → exactly one succeeds', async () => {
        const worker = await Worker.create({
            fullName: 'Race Worker',
            phone: `9${Date.now().toString().slice(-9)}`,
            aadhaarFront: 'x',
            aadhaarBack: 'y',
            balance: 1000,
            bankDetails: { holderName: 'A', bankName: 'B', accountNumber: '123456', ifscCode: 'IFSC0001' },
        });
        workerId = String(worker._id);
        const buildReq = () => ({ user: { id: workerId, role: 'worker' }, body: { amount: 1000 } });
        const a = makeRes();
        const b = makeRes();
        await Promise.all([requestWithdrawal(buildReq(), a.res), requestWithdrawal(buildReq(), b.res)]);
        const statuses = [a.captured.statusCode, b.captured.statusCode].sort();
        (0, vitest_1.expect)(statuses).toEqual([201, 400]); // one success, one insufficient — never both 201
        const after = await Worker.findById(workerId);
        (0, vitest_1.expect)(after?.balance).toBe(0); // never negative, never double-withdrawn
        const withdrawals = await Withdrawal.countDocuments({ worker: workerId });
        (0, vitest_1.expect)(withdrawals).toBe(1);
    });
});
//# sourceMappingURL=withdrawal.race.test.js.map