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
const bannerSchema = new mongoose_1.Schema({
    image: { type: String, required: true },
    imagePublicId: { type: String, default: '' },
    linkUrl: { type: String, default: '' },
    targetPage: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    editor: {
        crop: {
            x: { type: Number, default: 0 },
            y: { type: Number, default: 0 },
        },
        zoom: { type: Number, default: 1 },
        fitMode: { type: String, enum: ['cover', 'contain'], default: 'cover' },
        safeArea: { type: Boolean, default: true },
        focusX: { type: Number, default: 50 },
        focusY: { type: Number, default: 50 },
        brightness: { type: Number, default: 100 },
        contrast: { type: Number, default: 100 },
        blur: { type: Number, default: 0 },
    },
    cta: {
        enabled: { type: Boolean, default: false },
        text: { type: String, default: '' },
        url: { type: String, default: '' },
    },
    schedule: {
        startAt: { type: Date, default: null },
        endAt: { type: Date, default: null },
    },
}, { timestamps: true });
bannerSchema.index({ isActive: 1, order: 1 });
exports.default = mongoose_1.default.model('Banner', bannerSchema);
//# sourceMappingURL=Banner.js.map