const express = require('express');
const router = express.Router();
const pincodeController = require('../controllers/pincodeController');

// Pincode route
router.get('/pincode/:pincode', pincodeController.getPincodeDetails);

module.exports = router;