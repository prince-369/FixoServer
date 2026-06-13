import mongoose, { Document } from 'mongoose';
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
declare const _default: mongoose.Model<ICouponRedemption, {}, {}, {}, mongoose.Document<unknown, {}, ICouponRedemption, {}, mongoose.DefaultSchemaOptions> & ICouponRedemption & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ICouponRedemption>;
export default _default;
//# sourceMappingURL=CouponRedemption.d.ts.map