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
const mongoose_1 = __importStar(require("mongoose"));
const transactionSchema = new mongoose_1.Schema({
    tid: { type: String, required: true, unique: true },
    booking: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Booking' },
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    worker: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Worker' },
    type: {
        type: String,
        enum: ['booking_payment', 'worker_earning', 'refund', 'withdrawal', 'commission', 'dues_deposit', 'dues_auto_deduct', 'dues_wallet_deduct', 'reward_payout', 'worker_bonus'],
        required: true,
    },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['online', 'cash'], required: true },
    razorpayPaymentId: { type: String },
    razorpayOrderId: { type: String },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },
}, { timestamps: true });
transactionSchema.index({ tid: 1 });
transactionSchema.index({ user: 1, type: 1 });
transactionSchema.index({ worker: 1, type: 1 });
exports.default = mongoose_1.default.model('Transaction', transactionSchema);
//# sourceMappingURL=Transaction.js.map