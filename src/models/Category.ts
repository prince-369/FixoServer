import mongoose, { Schema, Document } from 'mongoose';

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

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    image: { type: String, default: '' },
    description: { type: String, default: '' },
    tagline: { type: String, default: '' },
    services: [{ title: { type: String, required: true }, description: { type: String, default: '' } }],
    highlights: [{ type: String }],
    faqs: [{ question: { type: String, required: true }, answer: { type: String, required: true } }],
    priceStartsFrom: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

categorySchema.index({ slug: 1 });
categorySchema.index({ isActive: 1, order: 1 });

export default mongoose.model<ICategory>('Category', categorySchema);
