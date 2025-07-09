const express = require('express');
require('dotenv').config();
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

// ✅ Middleware
app.use(express.json());
app.use(cors());

// ✅ Route Imports
const pincodeRoutes = require('./routes/pincodeRoutes');
const imgBase64Routes = require('./routes/imgBase64Routes');
const qrRoutes = require('./routes/qrRoutes');

// ✅ Use Routes
app.use('/api', pincodeRoutes);
app.use('/api/img-base64', imgBase64Routes);
app.use('/api/qr', qrRoutes);

// ✅ Static folder for saved images
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

// ✅ Root Route
app.get('/', (req, res) => {
  res.json({
    message: '🧩 Micro APIs Collection',
    usage: {
      pincode: '/api/pincode/:pincode',
      img_to_base64: 'POST /api/img-base64/to-base64 (form-data)',
      base64_to_img: 'POST /api/img-base64/from-base64 (JSON)',
      qr_generate: 'GET /api/qr/generate?data=HelloWorld',
    },
  });
});

// ✅ Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ✅ Start Server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

// ✅ Vercel Export
module.exports = app;
