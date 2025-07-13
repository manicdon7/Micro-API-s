const express = require('express');
require('dotenv').config();
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// Route Imports
const pincodeRoutes = require('./routes/pincodeRoutes');
const extractTextRoutes = require('./routes/extractText');
const imgBase64Routes = require('./routes/imgBase64Routes');
const qrRoutes = require('./routes/qrRoutes');
// const formatConverterRoutes = require('./routes/formatConverterRoutes');
const webScraperRoutes = require('./routes/webScraperRoutes');
// const docLayoutRoutes = require('./routes/docLayoutRoutes');
const colorPaletteRoutes = require('./routes/colorPaletteRoutes');
app.use(express.json({ limit: '50mb' })); // Increase from 10mb to 20mb
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Match for form-data
app.use('/api', pincodeRoutes);
app.use('/api/img-base64', imgBase64Routes);
app.use('/api/qr', qrRoutes);
// app.use('/api', formatConverterRoutes);
app.use('/api', webScraperRoutes);
app.use('/api', extractTextRoutes); // ✅ NEW
// app.use('/api', docLayoutRoutes);
app.use('/api', colorPaletteRoutes); // ✅ NEW

// ✅ Static folder for saved images
// app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

// ✅ Root Route
app.get('/', (req, res) => {
  res.json({
    message: '🚀Micro APIs Collection',
    usage: {
      pincode: '/api/pincode/:pincode',
      // img_to_base64: 'POST /api/img-base64/to-base64 (form-data)',
      // base64_to_img: 'POST /api/img-base64/from-base64 (JSON)',
      qr_generate: 'GET /api/qr/generate?data=HelloWorld',
      // convert_format: 'POST /api/convert-format (form-data with targetFormat)',
      scrape: 'GET /api/scrape?url=https://example.com',
      // doc_convert: 'POST /api/convert-doc (form-data: .html, .txt, .docx, .xls, .xlsx)',
      color_palette: 'GET /api/colors/palette?seed=#3498db&type=analogous' // ✅ NEW
    },
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});


// Start Server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

// Vercel Export
module.exports = app;
