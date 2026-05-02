import mongoose, { Document } from 'mongoose';
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
declare const _default: mongoose.Model<IBanner, {}, {}, {}, mongoose.Document<unknown, {}, IBanner, {}, mongoose.DefaultSchemaOptions> & IBanner & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IBanner>;
export default _default;
//# sourceMappingURL=Banner.d.ts.map