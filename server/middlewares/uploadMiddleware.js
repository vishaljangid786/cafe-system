const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'cafe_management',
    // Keep this in sync with the UI hint ("PNG / WEBP Supported"). WebP/GIF are
    // common formats (esp. images saved from the web); leaving them out made
    // Cloudinary reject the upload and surface an opaque 500 to the user.
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'],
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
