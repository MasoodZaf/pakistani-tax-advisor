'use strict';

/**
 * Express middleware that validates req.body / req.query / req.params against
 * a zod schema. Replaces ad-hoc `if (!req.body.email)` chains and gives the
 * client a uniform `{ success: false, error, message, fields }` shape on
 * failure that matches the rest of the API per `utils/sendError.js`.
 *
 * Response shape standard for the project:
 *   - Success: { success: true, ...payload }  (or 2xx with raw payload for
 *     legacy endpoints — incrementally migrating)
 *   - Validation error (400): { success: false, error: 'invalid_input',
 *     message, fields: { fieldPath: msg, ... } }
 *   - Uncaught error (5xx): { success: false, message, requestId } (from
 *     expressErrorHandler in app.js)
 *
 * Usage:
 *   const { z } = require('zod');
 *   const validate = require('../middleware/validate');
 *   const schema = z.object({ email: z.string().email(), password: z.string().min(12) });
 *   router.post('/login', validate(schema), handler);
 */

const sentry = require('../utils/sentry');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source];
    const result = schema.safeParse(data);
    if (!result.success) {
      // Flatten the zod issue list into `{ field: message }` for the client.
      const fields = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_root';
        fields[key] = issue.message;
      }
      return res.status(400).json({
        success: false,
        error: 'invalid_input',
        message: 'Request body failed validation',
        fields,
      });
    }
    // Replace with the parsed (coerced) value so downstream handlers see
    // numbers as numbers, dates as Dates, etc.
    req[source] = result.data;
    next();
  };
}

// Optional wrapper that swallows the throw and forwards to Sentry — used in
// rare spots where validation failure shouldn't block the request (e.g.
// soft-validate a webhook body).
function validateOptional(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (result.success) {
      req[source] = result.data;
    } else {
      sentry.captureMessage('Optional validation failed', 'warning');
    }
    next();
  };
}

module.exports = validate;
module.exports.validate = validate;
module.exports.validateOptional = validateOptional;
