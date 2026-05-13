"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadSingle = exports.uploadAadhaar = exports.uploadBookingVoice = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const storage = multer_1.default.memoryStorage();
const imageFileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
        cb(null, true);
    }
    else {
        cb(new Error('Only image files (jpeg, jpg, png, webp) are allowed'));
    }
};
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter: imageFileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
const audioFileFilter = (req, file, cb) => {
    const allowedExtensions = /webm|ogg|mp3|wav|m4a|aac|mp4/;
    const extension = path_1.default.extname(file.originalname).toLowerCase().replace('.', '');
    const validExtension = allowedExtensions.test(extension);
    const validMime = file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm' || file.mimetype === 'video/mp4';
    if (validExtension && validMime) {
        cb(null, true);
        return;
    }
    cb(new Error('Only audio files (webm, ogg, mp3, wav, m4a, aac, mp4) are allowed'));
};
exports.uploadBookingVoice = (0, multer_1.default)({
    storage,
    fileFilter: audioFileFilter,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
}).single('voiceNote');
exports.uploadAadhaar = exports.upload.fields([
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 },
]);
exports.uploadSingle = exports.upload.single('image');
//# sourceMappingURL=upload.middleware.js.map