import mongoose, { Document } from 'mongoose';
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
declare const _default: mongoose.Model<IChatbotQA, {}, {}, {}, mongoose.Document<unknown, {}, IChatbotQA, {}, mongoose.DefaultSchemaOptions> & IChatbotQA & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IChatbotQA>;
export default _default;
//# sourceMappingURL=ChatbotQA.d.ts.map