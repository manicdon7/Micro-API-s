const express = require('express');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware to parse JSON requests
app.use(express.json());

// Import routes
const pincodeRoutes = require('./routes/pincodeRoutes');

// Use routes
app.use('/api', pincodeRoutes);

// Root endpoint for API info
app.get('/', (req, res) => {
  res.json({
    message: 'Pincode to City/State API',
    usage: 'GET /api/pincode/:pincode',
    example: '/api/pincode/110001',
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Vercel export
module.exports = app;