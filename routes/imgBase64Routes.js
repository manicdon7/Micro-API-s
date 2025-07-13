const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const router = express.Router();
const upload = multer({ dest: '/tmp' });

// 🖼️ Image to Base64
router.post('/to-base64', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const filePath = req.file.path;

  fs.readFile(filePath, (err, data) => {
    if (err) return res.status(500).json({ error: 'File read error' });

    const base64 = `data:${req.file.mimetype};base64,${data.toString('base64')}`;
    fs.unlinkSync(filePath); // delete temp file

    res.json({ base64 });
  });
});

// 🔄 Base64 to Image
router.post('/from-base64', express.json({ limit: '10mb' }), (req, res) => {
  const { base64, filename = 'output.png' } = req.body;

  if (!base64) return res.status(400).json({ error: 'Base64 string is required' });

  const matches = base64.match(/^data:(.+);base64,(.+)$/);
  if (!matches) return res.status(400).json({ error: 'Invalid base64 format' });

  const buffer = Buffer.from(matches[2], 'base64');
  const outputDir = path.join(__dirname, '..', 'outputs');
  const outputPath = path.join(outputDir, filename);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, buffer);

  res.json({ message: 'Image saved successfully', path: `/outputs/${filename}` });
});

module.exports = router;
