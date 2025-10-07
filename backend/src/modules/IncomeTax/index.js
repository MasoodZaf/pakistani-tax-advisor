const express = require('express');
const incomeFormRoutes = require('./routes/incomeForm');
const taxFormsRoutes = require('./routes/taxForms');

const router = express.Router();

// Income Tax Module Routes
router.use('/income-form', incomeFormRoutes);
router.use('/tax-forms', taxFormsRoutes);

module.exports = router;