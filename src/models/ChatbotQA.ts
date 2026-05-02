import mongoose, { Schema, Document } from 'mongoose';

export interface IChatbotQA extends Document {
  category: string;
  targetAudience: 'all' | 'customer' | 'worker';
  keywords: string[];
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const chatbotQASchema = new Schema<IChatbotQA>(
  {
    category: { type: String, required: true },
    targetAudience: { type: String, enum: ['all', 'customer', 'worker'], default: 'all' },
    keywords: [{ type: String }],
    question: { type: String, required: true },
    answer: { type: String, required: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

chatbotQASchema.index({ category: 1, isActive: 1 });

export default mongoose.model<IChatbotQA>('ChatbotQA', chatbotQASchema);
