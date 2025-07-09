const express = require('express');
require('dotenv').config();
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5000;

// ✅ CORS FIRST
const corsOptions = {
  origin: 'http://127.0.0.1:5500',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // enable preflight response

// ✅ Middleware
app.use(express.json());

// ✅ Routes
const pincodeRoutes = require('./routes/pincodeRoutes');
const imgBase64Routes = require('./routes/imgBase64Routes');
app.use('/api', pincodeRoutes);
app.use('/api/img-base64', imgBase64Routes);

// ✅ Static access
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

// ✅ Root info
app.get('/', (req, res) => {
  res.json({
    message: 'Micro APIs Collection',
    endpoints: {
      pincode: '/api/pincode/:pincode',
      img_to_base64: 'POST /api/img-base64/to-base64 (form-data)',
      base64_to_img: 'POST /api/img-base64/from-base64 (JSON)',
    },
  });
});

// ✅ Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ✅ Start
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;
 