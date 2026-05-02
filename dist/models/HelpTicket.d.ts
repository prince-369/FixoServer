import mongoose, { Document } from 'mongoose';
export type TicketCategory = 'refund' | 'worker_related' | 'customer_related' | 'email_change' | 'about_us' | 'deactivate_account' | 'bank_details_update' | 'withdrawal' | 'withdrawal_issue' | 'dues_issue' | 'kyc_issue' | 'bidding_issue' | 'payment_issue' | 'account_issue' | 'profile_issue' | 'other';
export type TicketStatus = 'open' | 'escalated' | 'resolved';
export interface IChatMessage {
    sender: 'user' | 'bot' | 'admin';
    message: string;
    timestamp: Date;
}
export interface IHelpTicket extends Document {
    ticketNumber: string;
    user: mongoose.Types.ObjectId;
    userModel: 'User' | 'Worker';
    category: TicketCategory;
    chatHistory: IChatMessage[];
    status: TicketStatus;
    phoneNumber?: string;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IHelpTicket, {}, {}, {}, mongoose.Document<unknown, {}, IHelpTicket, {}, mongoose.DefaultSchemaOptions> & IHelpTicket & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IHelpTicket>;
export default _default;
//# sourceMappingURL=HelpTicket.d.ts.map