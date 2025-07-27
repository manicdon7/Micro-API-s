const express = require('express');
const router = express.Router();
const { generateQRCode } = require('../controllers/qrController'); // Adjust path to your controller

// Define the route with all params in the path
router.get('/qr/generate/:data/:size?/:type?/:fgColor?/:bgColor?', generateQRCode); // ? makes optional except data

module.exports = router;
