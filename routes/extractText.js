const express = require('express');
const router = express.Router();
const { extractTextFromBase64, extractTextFromImage, upload } = require('../controllers/extractTextController');

// Extract text from base64
router.post('/v1/extract-base64', extractTextFromBase64);
// Extract text from image file
router.post('/v1/extract-image', upload.single('image'), extractTextFromImage);

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