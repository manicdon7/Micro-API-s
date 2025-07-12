const QRCode = require('qrcode');

exports.generateQRCode = async (req, res) => {
  const { data } = req.query;
  if (!data) {
    return res.status(400).json({ error: 'Missing "data" query parameter' });
  }

  try {
    const base64Image = await QRCode.toDataURL(data);
    res.status(200).json({ base64: base64Image });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
};
