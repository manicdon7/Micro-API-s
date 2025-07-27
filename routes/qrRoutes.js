const express = require('express');
const router = express.Router();
const { generateQRCode } = require('../controllers/qrController');

router.get('/qr_generate', generateQRCode); // ✅ No ":" used, so no problem

module.exports = router;
