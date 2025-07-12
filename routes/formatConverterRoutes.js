// const express = require('express');
// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');
// const sharp = require('sharp');

// const router = express.Router();

// // Multer setup
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, 'outputs/'),
//   filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
// });
// const upload = multer({ storage });

// // Supported formats
// const allowedFormats = ['jpeg', 'png', 'webp', 'gif', 'tiff', 'bmp'];

// // ✅ POST /api/convert-format
// router.post('/convert-format', upload.single('image'), async (req, res) => {
//   const { targetFormat } = req.body;

//   if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });
//   if (!targetFormat || !allowedFormats.includes(targetFormat.toLowerCase())) {
//     return res.status(400).json({ error: `Please provide a valid targetFormat (${allowedFormats.join(', ')})` });
//   }

//   const inputPath = req.file.path;
//   const outputFileName = `${Date.now()}-converted.${targetFormat}`;
//   const outputPath = path.join('outputs', outputFileName);

//   try {
//     await sharp(inputPath).toFormat(targetFormat).toFile(outputPath);

//     res.json({
//       message: `Image converted to ${targetFormat}`,
//       url: `/outputs/${outputFileName}`,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Conversion failed' });
//   }
// });

// module.exports = router;
