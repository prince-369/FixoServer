import mongoose, { Schema, Document } from 'mongoose';

export interface IBannerEditorConfig {
  crop: {
    x: number;
    y: number;
  };
  zoom: number;
  fitMode: 'cover' | 'contain';
  safeArea: boolean;
  focusX: number;
  focusY: number;
  brightness: number;
  contrast: number;
  blur: number;
}

export interface IBannerCTA {
  enabled: boolean;
  text: string;
  url: string;
}

export interface IBannerSchedule {
  startAt?: Date | null;
  endAt?: Date | null;
}

export interface IBanner extends Document {
  image: string;
  imagePublicId?: string;
  linkUrl: string;
  targetPage: string;
  isActive: boolean;
  order: number;
  editor: IBannerEditorConfig;
  cta: IBannerCTA;
  schedule?: IBannerSchedule;
  createdAt: Date;
}

const bannerSchema = new Schema<IBanner>(
  {
    image: { type: String, required: true },
    imagePublicId: { type: String, default: '' },
    linkUrl: { type: String, default: '' },
    targetPage: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    editor: {
      crop: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
      },
      zoom: { type: Number, default: 1 },
      fitMode: { type: String, enum: ['cover', 'contain'], default: 'cover' },
      safeArea: { type: Boolean, default: true },
      focusX: { type: Number, default: 50 },
      focusY: { type: Number, default: 50 },
      brightness: { type: Number, default: 100 },
      contrast: { type: Number, default: 100 },
      blur: { type: Number, default: 0 },
    },
    cta: {
      enabled: { type: Boolean, default: false },
      text: { type: String, default: '' },
      url: { type: String, default: '' },
    },
    schedule: {
      startAt: { type: Date, default: null },
      endAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

bannerSchema.index({ isActive: 1, order: 1 });

export default mongoose.model<IBanner>('Banner', bannerSchema);
