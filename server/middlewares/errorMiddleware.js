const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = err.message;

  // Always log the real error — in production this goes to Vercel function logs
  // and is the only way to diagnose 500s that are hidden from the client.
  console.error(`[${statusCode}] ${req.method} ${req.originalUrl} — ${err.name}: ${err.message}`, err.stack ? `\n${err.stack}` : '');

  // Mongoose bad ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    message = 'Resource not found';
    statusCode = 404;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    message = Object.values(err.errors).map((val) => val.message).join(', ');
    statusCode = 400;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    message = 'Duplicate field value entered';
    statusCode = 400;
  }

  // Multer upload errors (file too large, unexpected field, etc.) are user errors.
  if (err.name === 'MulterError') {
    statusCode = 400;
    message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File is too large. Please upload an image under 5MB.'
      : `Upload error: ${err.message}`;
  }

  // Cloudinary (image host) rejections come back with an http_code — usually a
  // bad/unsupported file. Surface a clear, actionable message instead of a 500.
  if (err.http_code || /cloudinary/i.test(err.message || '') || /allowed formats|Invalid image file/i.test(err.message || '')) {
    statusCode = 400;
    message = 'Image upload failed. Please use a valid JPG, PNG or WEBP image under 5MB.';
  }

  // In production, never leak internal error details for server-side (>=500)
  // failures — these are typically unexpected/non-operational. Known 4xx errors
  // (validation, not-found, etc.) keep their specific, user-safe messages.
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    message = 'Something went wrong. Please try again later.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: null,
  });
};

module.exports = { notFound, errorHandler };
