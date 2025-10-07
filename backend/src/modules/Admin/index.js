const express = require('express');
const adminRoutes = require('./routes/admin');

const router = express.Router();

// Admin Module Routes
router.use('/', adminRoutes);

module.exports = router;