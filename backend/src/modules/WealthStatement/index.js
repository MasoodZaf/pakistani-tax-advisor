const express = require('express');
const wealthFormRoutes = require('./routes/wealthForm');

const router = express.Router();

// Wealth Statement Module Routes
router.use('/form', wealthFormRoutes);

module.exports = router;