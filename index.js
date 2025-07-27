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
app.use('/api', qrRoutes);
// app.use('/api', formatConverterRoutes);
app.use('/api', webScraperRoutes);
app.use('/api', extractTextRoutes);
// app.use('/api', docLayoutRoutes);
app.use('/api', colorPaletteRoutes); 

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
// ✅ Static folder for saved images
// app.use('/tmp', express.static(path.join(__dirname, 'tmp')));

// ✅ Root Route
app.get('/', (req, res) => {
  res.json({
    message: '🚀Micro APIs Collection',
    usage: {
      pincode: '/api/pincode/:pincode',
      scrape: 'GET /api/scrape?url=https://example.com',
      qr_generate: 'GET /qr/generate/:data/:size?/:type?/:fgColor?/:bgColor?',
      extractionV1:'/api/v1/extract-base64 (JSON)',
      extractionV2:'/api/v2/extract-base64 (JSON)',
      extractionImageV1: '/api/v1/extract-image (form-data: image)',
      extractionImageV2: '/api/v2/extract-image (form-data: image)',
      // img_to_base64: 'POST /api/img-base64/to-base64 (form-data)',
      // base64_to_img: 'POST /api/img-base64/from-base64 (JSON)',
      // convert_format: 'POST /api/convert-format (form-data with targetFormat)',
      // doc_convert: 'POST /api/convert-doc (form-data: .html, .txt, .docx, .xls, .xlsx)',
      // color_palette: 'GET /api/colors/palette?seed=#3498db&type=analogous' // ✅ NEW
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
