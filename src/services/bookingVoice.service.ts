import Booking from '../models/Booking';
import { deleteFromCloudinary } from './cloudinary.service';

export const removeBookingVoiceNote = async (booking: {
  _id: unknown;
  voiceNote?: { publicId?: string } | null;
}): Promise<boolean> => {
  const publicId = booking.voiceNote?.publicId?.trim();
  if (!publicId) return false;

  try {
    await deleteFromCloudinary(publicId, 'video');
    await Booking.updateOne({ _id: booking._id as any }, { $unset: { voiceNote: 1 } });
    return true;
  } catch (error) {
    console.error('Voice note cleanup failed:', error);
    return false;
  }
};
