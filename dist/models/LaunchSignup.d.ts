import mongoose, { Document } from 'mongoose';
/**
 * Pre-launch waitlist from the marketing site (fixoservice.in).
 *
 * Distinct from `Waitlist`, which is an in-app request from a signed-in customer
 * asking Fixo to expand to their location. This one is anonymous: a visitor leaves
 * an email or phone so we can tell them when Fixo goes live.
 */
export type LaunchSignupRole = 'customer' | 'worker';
export interface ILaunchSignup extends Document {
    contact: string;
    email?: string;
    phone?: string;
    role: LaunchSignupRole;
    source: string;
    notified: boolean;
    notifiedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<ILaunchSignup, {}, {}, {}, mongoose.Document<unknown, {}, ILaunchSignup, {}, mongoose.DefaultSchemaOptions> & ILaunchSignup & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ILaunchSignup>;
export default _default;
//# sourceMappingURL=LaunchSignup.d.ts.map