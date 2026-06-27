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
const User_1 = require("./User");
const workerSchema = new mongoose_1.Schema({
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, lowercase: true, trim: true, sparse: true },
    password: { type: String, select: false },
    googleId: { type: String, sparse: true },
    aadhaarFront: { type: String, required: true },
    aadhaarBack: { type: String, required: true },
    accountStatus: {
        type: String,
        enum: ['test', 'ekyc_pending', 'ekyc_done', 'approved', 'rejected', 'live'],
        default: 'test',
    },
    ekycRejectionReason: { type: String },
    videoKycIncompleteReason: { type: String, default: '' },
    videoKycRetryAvailableAt: { type: Date, default: null },
    videoKycAwaitingResult: { type: Boolean, default: false },
    videoKycCallEndedAt: { type: Date, default: null },
    ekycCaptures: [{
            url: { type: String, required: true },
            capturedAt: { type: Date, default: Date.now },
        }],
    profileCompleted: { type: Boolean, default: false },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] },
        address: { type: String, default: '' },
    },
    currentLocation: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: undefined },
        address: { type: String, default: '' },
        updatedAt: { type: Date, default: null },
    },
    categories: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Category' }],
    skills: [{
            category: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Category', required: true },
            experienceYears: { type: Number, default: 0 },
            confirmed: { type: Boolean, default: false },
            status: { type: String, enum: ['pending_kyc', 'approved', 'pending_review', 'rejected'], default: 'pending_kyc' },
            experienceBumpsUsed: { type: Number, default: 0 },
            rejectionReason: { type: String, default: '' },
            callAttempts: { type: Number, default: 0 },
            requestedAt: { type: Date, default: Date.now },
            decidedAt: { type: Date, default: null },
        }],
    bio: { type: String, default: '', maxlength: 1000 },
    regularPhone: { type: String, default: '' },
    extraPhones: [{ type: String }],
    profileImage: { type: String, default: '' },
    isActive: { type: Boolean, default: false },
    balance: { type: Number, default: 0 },
    bankDetails: {
        holderName: { type: String },
        bankName: { type: String },
        accountNumber: { type: String },
        ifscCode: { type: String },
    },
    rating: {
        average: { type: Number, default: 0 },
        count: { type: Number, default: 0 },
    },
    totalWorkDone: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    block: { type: User_1.blockSchemaDefinition, default: () => ({}) },
}, { timestamps: true });
workerSchema.index({ location: '2dsphere' });
workerSchema.index({ currentLocation: '2dsphere' });
workerSchema.index({ phone: 1 });
workerSchema.index({ googleId: 1 });
workerSchema.index({ accountStatus: 1 });
workerSchema.index({ isActive: 1 });
exports.default = mongoose_1.default.model('Worker', workerSchema);
//# sourceMappingURL=Worker.js.map