"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeBookingVoiceNote = void 0;
const Booking_1 = __importDefault(require("../models/Booking"));
const cloudinary_service_1 = require("./cloudinary.service");
const removeBookingVoiceNote = async (booking) => {
    const publicId = booking.voiceNote?.publicId?.trim();
    if (!publicId)
        return false;
    try {
        await (0, cloudinary_service_1.deleteFromCloudinary)(publicId, 'video');
        await Booking_1.default.updateOne({ _id: booking._id }, { $unset: { voiceNote: 1 } });
        return true;
    }
    catch (error) {
        console.error('Voice note cleanup failed:', error);
        return false;
    }
};
exports.removeBookingVoiceNote = removeBookingVoiceNote;
//# sourceMappingURL=bookingVoice.service.js.map