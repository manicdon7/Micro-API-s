const express = require('express');
const router = express.Router();
const { extractTextFromBase64V1, extractTextFromImageV1, uploadV1 } = require('../controllers/extractTextControllerV1');
const { extractTextFromImageV2, uploadV2, extractTextFromBase64V2 } = require('../controllers/extractTextControllerV2');
const multer = require('multer');

// Extract text from base64v1
router.post('/v1/extract-base64', extractTextFromBase64V1);
// Extract text from image filev1
router.post('/v1/extract-image', uploadV1.single('image'), extractTextFromImageV1);
// Extract text from base64v2
router.post('/v2/extract-base64', extractTextFromBase64V2);
// Extract text from image filev2
router.post('/v2/extract-image', uploadV2.single('image'), extractTextFromImageV2);

router.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  if (err.message === 'Only PNG and JPEG images are supported') {
    return res.status(400).json({ error: 'Only PNG and JPEG images are supported' });
  } else if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});


module.exports = router;