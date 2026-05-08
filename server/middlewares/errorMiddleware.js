const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = err.message;

  if (process.env.NODE_ENV === 'production') {
    // Operational summary only — keep stack out of stdout
    console.error(`[${statusCode}] ${req.method} ${req.originalUrl} — ${message}`);
  } else {
    console.error('SERVER_ERROR:', err);
  }

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

  res.status(statusCode).json({
    success: false,
    message,
    stack: null,
  });
};

module.exports = { notFound, errorHandler };
