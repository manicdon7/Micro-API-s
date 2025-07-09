const express = require('express');
const router = express.Router();
const { generateQRCode } = require('../controllers/qrController');

router.get('/generate', generateQRCode); // ✅ No ":" used, so no problem

module.exports = router;
