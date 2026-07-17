import mongoose, { Document } from 'mongoose';
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
declare const _default: mongoose.Model<IPartnerRequest, {}, {}, {}, mongoose.Document<unknown, {}, IPartnerRequest, {}, mongoose.DefaultSchemaOptions> & IPartnerRequest & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IPartnerRequest>;
export default _default;
//# sourceMappingURL=PartnerRequest.d.ts.map