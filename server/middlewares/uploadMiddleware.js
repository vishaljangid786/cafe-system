const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'cafe_management',
    // No format whitelist on purpose: accept ANY image (png / jpg / jpeg / webp /
    // gif / avif / heic / bmp / svg / tiff …) plus PDF. The real gate is the
    // multer `fileFilter` below (image/* or application/pdf), so a whitelist here
    // only caused surprise "upload failed" errors for perfectly valid images.
    // resource_type 'auto' lets Cloudinary detect images vs. PDFs correctly.
    resource_type: 'auto',
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      const err = new Error('Invalid file type. Please upload an image (JPG, PNG, WEBP) or PDF.');
      err.statusCode = 400;
      cb(err, false);
    }
  }
});

module.exports = upload;
