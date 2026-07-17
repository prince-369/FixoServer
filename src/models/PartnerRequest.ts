import mongoose, { Schema, Document } from 'mongoose';

/**
 * "Partner with Fixo" enquiry from the marketing site — agencies, manpower
 * suppliers, training institutes, brands and city launch partners.
 */
export type PartnerRequestStatus = 'new' | 'contacted' | 'closed';

export interface IPartnerRequest extends Document {
  fullName: string;
  company: string;
  phone: string;
  email: string;
  city: string;
  partnershipType: string;
  message: string;
  status: PartnerRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

const partnerRequestSchema = new Schema<IPartnerRequest>(
  {
    fullName: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    city: { type: String, default: '', trim: true },
    partnershipType: { type: String, default: '', trim: true },
    message: { type: String, default: '', maxlength: 2000 },
    status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new', index: true },
  },
  { timestamps: true }
);

partnerRequestSchema.index({ createdAt: -1 });

export default mongoose.model<IPartnerRequest>('PartnerRequest', partnerRequestSchema);
