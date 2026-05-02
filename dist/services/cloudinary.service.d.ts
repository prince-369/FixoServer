export declare const uploadToCloudinary: (filePath: string, folder: string) => Promise<{
    url: string;
    publicId: string;
}>;
export declare const uploadBufferToCloudinary: (buffer: Buffer, folder: string) => Promise<{
    url: string;
    publicId: string;
}>;
export declare const deleteFromCloudinary: (publicId: string) => Promise<void>;
//# sourceMappingURL=cloudinary.service.d.ts.map