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
const bookingSchema = new mongoose_1.Schema({
    customer: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Category', required: true },
    workDescription: { type: String, required: true },
    voiceNote: {
        url: { type: String },
        publicId: { type: String },
        mimeType: { type: String },
        durationSec: { type: Number },
        language: { type: String },
        transcript: { type: String },
        createdAt: { type: Date },
    },
    customerLocation: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true },
        address: { type: String, required: true },
    },
    timeSlot: {
        type: String,
        enum: ['anytime', 'morning', 'afternoon', 'evening'],
        default: 'anytime',
    },
    status: {
        type: String,
        enum: ['finding_workers', 'bids_received', 'worker_accepted', 'worker_approved', 'payment_done', 'in_progress', 'completed', 'cancelled'],
        default: 'finding_workers',
    },
    acceptedBid: { type: mongoose_1.Schema.Types.ObjectId, ref: 'WorkBid' },
    assignedWorker: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Worker' },
    paymentMethod: { type: String, enum: ['online', 'cash'] },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'refund_pending', 'refunded'],
        default: 'pending',
    },
    amount: { type: Number, default: 0 },
    cashSurcharge: { type: Number, default: 0 },
    couponCode: { type: String },
    couponCampaign: { type: mongoose_1.Schema.Types.ObjectId, ref: 'CouponCampaign' },
    discountAmount: { type: Number, default: 0 },
    completionPin: { type: String },
    completionRequestedByWorkerAt: { type: Date },
    completionCodeRevealedAt: { type: Date },
    workerMessage: { type: String },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    cancellation: {
        cancelledBy: { type: String, enum: ['customer', 'worker', 'admin'] },
        reason: { type: String },
        cancelledAt: { type: Date },
    },
    refundDetails: {
        upiId: { type: String },
        bankAccountNumber: { type: String },
        ifscCode: { type: String },
        bankName: { type: String },
        holderName: { type: String },
        status: { type: String, enum: ['pending', 'completed'] },
        processedAt: { type: Date },
    },
    review: {
        rating: { type: Number, min: 1, max: 5 },
        feedback: { type: String },
        createdAt: { type: Date },
    },
}, { timestamps: true });
bookingSchema.index({ customer: 1, status: 1 });
bookingSchema.index({ assignedWorker: 1, status: 1 });
bookingSchema.index({ customer: 1, createdAt: -1 });
bookingSchema.index({ assignedWorker: 1, createdAt: -1 });
bookingSchema.index({ customerLocation: '2dsphere' });
bookingSchema.index({ status: 1 });
bookingSchema.index({ status: 1, createdAt: 1 });
exports.default = mongoose_1.default.model('Booking', bookingSchema);
//# sourceMappingURL=Booking.js.map