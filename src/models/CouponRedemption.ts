import mongoose, { Schema, Document } from 'mongoose';

export interface ICouponRedemption extends Document {
  coupon: mongoose.Types.ObjectId;
  couponCode: string;
  user: mongoose.Types.ObjectId;
  booking: mongoose.Types.ObjectId;
  discountAmount: number;
  orderAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

const couponRedemptionSchema = new Schema<ICouponRedemption>(
  {
    coupon: { type: Schema.Types.ObjectId, ref: 'CouponCampaign', required: true },
    couponCode: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    discountAmount: { type: Number, required: true },
    orderAmount: { type: Number, required: true },
  },
  { timestamps: true }
);

couponRedemptionSchema.index({ coupon: 1, user: 1 });
couponRedemptionSchema.index({ booking: 1 }, { unique: true }); // one coupon use per booking
couponRedemptionSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model<ICouponRedemption>('CouponRedemption', couponRedemptionSchema);
