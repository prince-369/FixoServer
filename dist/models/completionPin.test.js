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
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
let Booking;
(0, vitest_1.beforeAll)(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret';
    Booking = (await Promise.resolve().then(() => __importStar(require('./Booking')))).default;
});
(0, vitest_1.describe)('completionPin exposure', () => {
    (0, vitest_1.it)('is excluded from queries by default', () => {
        const path = Booking.schema.path('completionPin');
        // `selected: false` is what keeps the PIN out of every worker-facing payload.
        (0, vitest_1.expect)(path.options.select)
            .toBe(false);
    });
    (0, vitest_1.it)('is absent from a document projected without it', () => {
        // Mirrors a worker-facing read: no `.select('+completionPin')`.
        const doc = new Booking({ status: 'payment_done' }, 'status');
        (0, vitest_1.expect)(doc.completionPin).toBeUndefined();
        (0, vitest_1.expect)(JSON.stringify(doc)).not.toContain('completionPin');
    });
    (0, vitest_1.it)('is present when a customer-facing read opts in', () => {
        const doc = new Booking({ status: 'payment_done', completionPin: '4821' });
        (0, vitest_1.expect)(doc.completionPin).toBe('4821');
    });
    (0, vitest_1.it)('is unset — not silently kept — when a booking is reopened', () => {
        // rejectBooking clears the PIN on a document loaded WITHOUT that path selected.
        // Mongoose must still emit $unset, or a stale PIN would survive re-assignment.
        const doc = new Booking({ status: 'payment_done' }, 'status');
        doc.status = 'bids_received';
        doc.completionPin = undefined;
        const changes = doc.$getChanges();
        (0, vitest_1.expect)(changes.$unset).toHaveProperty('completionPin');
    });
});
//# sourceMappingURL=completionPin.test.js.map