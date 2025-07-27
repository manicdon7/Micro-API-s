const express = require('express');
const router = express.Router();
const { generateQRCode } = require('../controllers/qrController'); // Adjust path to your controller

router.post('/qr/generate', (req, res) => {
  console.log('QR generate endpoint hit with body:', req.body); // Debug log for verification
  generateQRCode(req, res);
});

module.exports = router;
