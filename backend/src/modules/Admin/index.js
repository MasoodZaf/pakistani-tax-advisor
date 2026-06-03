const express = require('express');
const adminRoutes = require('./routes/admin');
const taxRatesRoutes = require('./routes/taxRates');
const ratesBundleRoutes = require('./routes/ratesBundle');
const playbookRoutes = require('./routes/playbook');

const router = express.Router();

// Mounted before the catch-all adminRoutes so they aren't shadowed.
router.use('/tax-rates', taxRatesRoutes);
router.use('/rates-bundle', ratesBundleRoutes);
router.use('/playbook', playbookRoutes);

// All other admin routes.
router.use('/', adminRoutes);

module.exports = router;
