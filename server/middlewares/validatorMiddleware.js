const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  
  const extractedErrors = [];
  errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));

  // Surface the FIRST specific field error as the top-level message so clients
  // that show `message` get an actionable reason (e.g. "Invalid GSTIN format")
  // instead of an opaque "Validation failed".
  return res.status(422).json({
    success: false,
    message: errors.array()[0]?.msg || 'Validation failed',
    errors: extractedErrors,
  });
};

module.exports = validate;
