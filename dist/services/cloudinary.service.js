"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFromCloudinary = exports.uploadAudioBufferToCloudinary = exports.uploadBufferToCloudinary = exports.uploadToCloudinary = void 0;
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const uploadToCloudinary = async (filePath, folder) => {
    const result = await cloudinary_1.default.uploader.upload(filePath, {
        folder: `fixo/${folder}`,
        resource_type: 'image',
    });
    return {
        url: result.secure_url,
        publicId: result.public_id,
    };
};
exports.uploadToCloudinary = uploadToCloudinary;
const uploadBufferToCloudinary = async (buffer, folder) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary_1.default.uploader.upload_stream({ folder: `fixo/${folder}`, resource_type: 'image' }, (error, result) => {
            if (error || !result) {
                reject(error || new Error('Upload failed'));
                return;
            }
            resolve({
                url: result.secure_url,
                publicId: result.public_id,
            });
        });
        stream.end(buffer);
    });
};
exports.uploadBufferToCloudinary = uploadBufferToCloudinary;
const uploadAudioBufferToCloudinary = async (buffer, folder) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary_1.default.uploader.upload_stream({ folder: `fixo/${folder}`, resource_type: 'video' }, (error, result) => {
            if (error || !result) {
                reject(error || new Error('Upload failed'));
                return;
            }
            resolve({
                url: result.secure_url,
                publicId: result.public_id,
            });
        });
        stream.end(buffer);
    });
};
exports.uploadAudioBufferToCloudinary = uploadAudioBufferToCloudinary;
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
    await cloudinary_1.default.uploader.destroy(publicId, { resource_type: resourceType });
};
exports.deleteFromCloudinary = deleteFromCloudinary;
//# sourceMappingURL=cloudinary.service.js.map