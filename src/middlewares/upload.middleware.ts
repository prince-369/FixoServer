import multer from 'multer';
import path from 'path';

const storage = multer.memoryStorage();

const imageFileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, webp) are allowed'));
  }
};

export const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const audioFileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = /webm|ogg|mp3|wav|m4a|aac|mp4/;
  const extension = path.extname(file.originalname).toLowerCase().replace('.', '');
  const validExtension = allowedExtensions.test(extension);
  const validMime = file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm' || file.mimetype === 'video/mp4';

  if (validExtension && validMime) {
    cb(null, true);
    return;
  }

  cb(new Error('Only audio files (webm, ogg, mp3, wav, m4a, aac, mp4) are allowed'));
};

export const uploadBookingVoice = multer({
  storage,
  fileFilter: audioFileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
}).single('voiceNote');

export const uploadAadhaar = upload.fields([
  { name: 'aadhaarFront', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 },
]);

export const uploadSingle = upload.single('image');
