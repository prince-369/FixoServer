import mongoose, { Document } from 'mongoose';
export interface ICategoryService {
    title: string;
    description: string;
}
export interface ICategoryFAQ {
    question: string;
    answer: string;
}
export interface ICategory extends Document {
    name: string;
    slug: string;
    image: string;
    description: string;
    tagline: string;
    services: ICategoryService[];
    highlights: string[];
    faqs: ICategoryFAQ[];
    priceStartsFrom: number;
    isActive: boolean;
    order: number;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<ICategory, {}, {}, {}, mongoose.Document<unknown, {}, ICategory, {}, mongoose.DefaultSchemaOptions> & ICategory & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ICategory>;
export default _default;
//# sourceMappingURL=Category.d.ts.map