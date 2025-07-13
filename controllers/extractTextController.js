const Tesseract = require('tesseract.js');
const NodeCache = require('node-cache');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const cache = new NodeCache({ stdTTL: 3600, maxKeys: 1000 }); // Cache for 1 hour, limit to 1000 keys
const tessdataPath = '/tmp/tessdata/'; // Vercel-compatible path for traineddata

// Multer setup for image uploads
const uploadDir = '/tmp/images/';
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.png', '.jpeg', '.jpg'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG and JPEG images are supported')); // Trigger error for middleware
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit to 5MB
});

// Helper function to validate base64 image
function isValidBase64Image(base64String) {
  const base64Regex = /^data:image\/(png|jpeg|jpg);base64,[A-Za-z0-9+/=]+$/;
  const rawBase64Regex = /^[A-Za-z0-9+/=]+$/;
  return base64Regex.test(base64String) || (rawBase64Regex.test(base64String) && base64String.length % 4 === 0);
}

// Helper function to clean extracted text
function cleanText(text) {
  return text
    .replace(/[^a-zA-Z0-9\s._-]/g, '') // Keep alphanumeric, spaces, dots, underscores, hyphens
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single
    .trim();
}

// Helper function to clean up tessdata directory
async function cleanupTessdata() {
  try {
    const files = await fs.readdir(tessdataPath).catch(() => []);
    for (const file of files) {
      if (file.endsWith('.traineddata')) {
        await fs.unlink(path.join(tessdataPath, file)).catch(() => {});
      }
    }
  } catch (error) {
    console.error('Tessdata cleanup error:', error.message);
  }
}

// Controller function to extract text from base64
async function extractTextFromBase64(req, res) {
  const { base64 } = req.body;

  // Validate input
  if (!base64) {
    return res.status(400).json({ error: 'Missing "base64" in request body' });
  }
  if (!isValidBase64Image(base64)) {
    return res.status(400).json({ error: 'Invalid base64 image format. Must be PNG or JPEG.' });
  }

  // Check cache
  const cacheKey = `text_${base64.slice(0, 50)}`;
  const cachedResult = cache.get(cacheKey);
  if (cachedResult) {
    return res.status(200).json({ text: cachedResult });
  }

  let worker;
  try {
    // Remove data URI prefix if present
    const cleanBase64 = base64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    const inputBuffer = Buffer.from(cleanBase64, 'base64');

    // Initialize Tesseract worker
    worker = await Tesseract.createWorker('eng', 1, {
      cachePath: tessdataPath, // Store traineddata in /tmp/tessdata
      logger: () => {}, // Disable logging
    });
    await worker.setParameters({
      tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._- ', // Restrict characters
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK, // Single block of text
    });

    // Perform OCR
    const { data: { text } } = await worker.recognize(inputBuffer);

    if (!text.trim()) {
      return res.status(400).json({ error: 'No text detected in the image' });
    }

    // Clean and cache the result
    const cleanedText = cleanText(text);
    cache.set(cacheKey, cleanedText);

    res.status(200).json({ text: cleanedText });
  } catch (error) {
    console.error('Base64 text extraction error:', error.message);
    res.status(500).json({ error: 'Failed to extract text from base64 image' });
  } finally {
    if (worker) await worker.terminate(); // Free memory
    await cleanupTessdata(); // Clean up traineddata files
  }
}

// Controller function to extract text from image file
async function extractTextFromImage(req, res) {
  const imageFile = req.file;

  // Validate input
  if (!imageFile) {
    return res.status(400).json({ error: 'Missing "image" in request' });
  }

  const cacheKey = `text_${imageFile.filename}`;
  const cachedResult = cache.get(cacheKey);
  if (cachedResult) {
    return res.status(200).json({ text: cachedResult });
  }

  let worker;
  try {
    // Read image file
    const inputBuffer = await fs.readFile(imageFile.path);

    // Initialize Tesseract worker
    worker = await Tesseract.createWorker('eng', 1, {
      cachePath: tessdataPath, // Store traineddata in /tmp/tessdata
      logger: () => {}, // Disable logging
    });
    await worker.setParameters({
      tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._- ', // Restrict characters
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK, // Single block of text
    });

    // Perform OCR
    const { data: { text } } = await worker.recognize(inputBuffer);

    if (!text.trim()) {
      return res.status(400).json({ error: 'No text detected in the image' });
    }

    // Clean and cache the result
    const cleanedText = cleanText(text);
    cache.set(cacheKey, cleanedText);

    res.status(200).json({ text: cleanedText });
  } catch (error) {
    console.error('Image text extraction error:', error.message);
    res.status(500).json({ error: 'Failed to extract text from image' });
  } finally {
    // Clean up uploaded file and worker
    if (imageFile && imageFile.path && (await fs.stat(imageFile.path).catch(() => false))) {
      await fs.unlink(imageFile.path);
    }
    if (worker) await worker.terminate();
    await cleanupTessdata(); // Clean up traineddata files
  }
}

module.exports = { extractTextFromBase64, extractTextFromImage, upload };