// const fs = require('fs');
// const path = require('path');

// exports.imgToBase64 = (req, res) => {
//   if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

//   const imagePath = req.file.path;
//   const ext = path.extname(req.file.originalname).slice(1);
//   const base64 = fs.readFileSync(imagePath, { encoding: 'base64' });

//   res.json({
//     filename: req.file.filename,
//     base64: `data:image/${ext};base64,${base64}`,
//   });
// };

// exports.base64ToImg = (req, res) => {
//   const { base64, filename = 'image.png' } = req.body;
//   if (!base64) return res.status(400).json({ error: 'Base64 is required' });

//   const matches = base64.match(/^data:image\/(\w+);base64,(.+)$/);
//   if (!matches) return res.status(400).json({ error: 'Invalid base64 format' });

//   const ext = matches[1];
//   const data = matches[2];
//   const filepath = path.join('outputs', `${Date.now()}-${filename}`);
//   fs.writeFileSync(filepath, Buffer.from(data, 'base64'));

//   res.json({
//     message: 'Image saved successfully',
//     url: `/outputs/${path.basename(filepath)}`,
//   });
// };
