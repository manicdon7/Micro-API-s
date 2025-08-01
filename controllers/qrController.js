const QRCode = require('qrcode');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const POLLINATIONS_API_URL = process.env.POLLINATIONS_API_URL;

// Function to validate/get hex color via Pollinations API (unchanged)
const getHexColor = async (colorInput) => {
  const prompt = `Given the color input "${colorInput}", provide the corresponding 6-digit hex color code in JSON format like {"color": "#RRGGBB"}, if the color is valid. If invalid, return {"error": "Invalid color"}.`;

  try {
    const response = await axios.post(
      POLLINATIONS_API_URL,
      {
        messages: [{ role: 'user', content: prompt }],
        model: 'openai-fast',
        private: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const result = response.data; // Adjust if needed for response structure
    return result.color || result.error || '#000000';
  } catch (error) {
    console.error('Pollinations API error:', error.message);
    return '#000000';
  }
};

exports.generateQRCode = async (req, res) => {
  const { data, size, type, fgColor, bgColor } = req.body; // ✅ All from request body (JSON)

  // Validate required field
  if (!data) {
    return res.status(400).json({ error: 'Missing required "data" in request body' });
  }

  // Set defaults
  const qrMargin = 1;
  const qrScale = size && !isNaN(size) ? parseInt(size) : 7;
  const qrType = ['png', 'svg', 'jpeg', 'jpg'].includes(type) ? type : 'png';

  // Get hex colors from Pollinations API or use defaults
  const qrFgColor = fgColor ? await getHexColor(fgColor) : '#000000';
  const qrBgColor = bgColor ? await getHexColor(bgColor) : '#FFFFFF';

  if (qrFgColor === qrBgColor) {
    return res.status(400).json({ error: 'Background and foreground colors cannot be the same' });
  }

  if (qrFgColor === 'Invalid color' || qrBgColor === 'Invalid color') {
    return res.status(400).json({ error: 'Invalid color input' });
  }

  try {
    // Generate QR code as a buffer
    const qrBuffer = await QRCode.toBuffer(data, {
      type: qrType,
      margin: qrMargin,
      scale: qrScale,
      color: {
        dark: qrFgColor,
        light: qrBgColor
      },
    });

    // Set response headers
    res.setHeader('Content-Type', `image/${qrType}`);
    res.setHeader('Content-Disposition', `inline; filename="qrcode.${qrType}"`);

    // Send the buffer
    res.status(200).send(qrBuffer);
  } catch (error) {
    console.error('QR code generation error:', error.message);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
};
