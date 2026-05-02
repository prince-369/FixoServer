import mongoose, { Schema, Document } from 'mongoose';

export type TicketCategory =
  | 'refund'
  | 'worker_related'
  | 'customer_related'
  | 'email_change'
  | 'about_us'
  | 'deactivate_account'
  | 'bank_details_update'
  | 'withdrawal'
  | 'withdrawal_issue'
  | 'dues_issue'
  | 'kyc_issue'
  | 'bidding_issue'
  | 'payment_issue'
  | 'account_issue'
  | 'profile_issue'
  | 'other';

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

const helpTicketSchema = new Schema<IHelpTicket>(
  {
    ticketNumber: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, required: true, refPath: 'userModel' },
    userModel: { type: String, required: true, enum: ['User', 'Worker'] },
    category: {
      type: String,
      enum: [
        'refund',
        'worker_related',
        'customer_related',
        'email_change',
        'about_us',
        'deactivate_account',
        'bank_details_update',
        'withdrawal',
        'withdrawal_issue',
        'dues_issue',
        'kyc_issue',
        'bidding_issue',
        'payment_issue',
        'account_issue',
        'profile_issue',
        'other',
      ],
      required: true,
    },
    chatHistory: [
      {
        sender: { type: String, enum: ['user', 'bot', 'admin'], required: true },
        message: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ['open', 'escalated', 'resolved'],
      default: 'open',
    },
    phoneNumber: { type: String },
  },
  { timestamps: true }
);

helpTicketSchema.index({ user: 1, status: 1 });
helpTicketSchema.index({ status: 1, userModel: 1 });

export default mongoose.model<IHelpTicket>('HelpTicket', helpTicketSchema);
