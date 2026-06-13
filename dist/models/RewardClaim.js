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
const rewardClaimSchema = new mongoose_1.Schema({
    customer: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    milestone: { type: mongoose_1.Schema.Types.ObjectId, ref: 'RewardMilestone', required: true },
    milestoneKey: { type: String, required: true },
    bookingsRequired: { type: Number, required: true },
    rewardAmount: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending_approval', 'approved', 'paid', 'rejected'],
        default: 'pending_approval',
    },
    payoutDetails: {
        method: { type: String, enum: ['upi', 'bank'], required: true },
        upiId: { type: String },
        bankAccountNumber: { type: String },
        ifscCode: { type: String },
        bankName: { type: String },
        holderName: { type: String },
    },
    eligibleCountAtClaim: { type: Number, required: true },
    rejectionReason: { type: String },
    reviewedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Admin' },
    reviewedAt: { type: Date },
    paidAt: { type: Date },
    adminOverride: { type: Boolean, default: false },
}, { timestamps: true });
// CRITICAL anti-fraud: one claim per customer per milestone, ever.
rewardClaimSchema.index({ customer: 1, milestoneKey: 1 }, { unique: true });
rewardClaimSchema.index({ status: 1, createdAt: -1 });
exports.default = mongoose_1.default.model('RewardClaim', rewardClaimSchema);
//# sourceMappingURL=RewardClaim.js.map