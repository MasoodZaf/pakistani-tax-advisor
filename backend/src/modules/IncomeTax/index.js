const express = require('express');
const taxFormsRoutes = require('./routes/taxForms');

const router = express.Router();

router.use('/tax-forms', taxFormsRoutes);

module.exports = router;