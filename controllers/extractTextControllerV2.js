const Tesseract = require('tesseract.js');
const NodeCache = require('node-cache');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

// --- Configuration ---
const cache = new NodeCache({ stdTTL: 3600, maxKeys: 1000 }); // Cache results for 1 hour
const TESSDATA_PATH = '/tmp/tessdata'; // Vercel-compatible path for traineddata
const UPLOAD_DIR = '/tmp/uploads'; // Vercel-compatible path for uploads

// --- Multer Setup for Image Uploads ---
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const uploadV2 = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/; // Added PDF support
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Error: File upload only supports the following filetypes - ' + allowedTypes));
  },
  limits: { fileSize: 20 * 1024 * 1024 }, // Increased limit to 20MB for larger scanned documents
});


// --- Helper Functions ---

/**
 * Validates if a string is a valid base64 image.
 * @param {string} base64String The base64 string to validate.
 * @returns {boolean} True if the string is a valid base64 image.
 */
function isValidBase64Image(base64String) {
  const base64Regex = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  return base64Regex.test(base64String);
}


/**
 * Cleans and normalizes the extracted text from OCR.
 * @param {string} text The raw extracted text.
 * @returns {string} The cleaned text.
 */
function cleanText(text) {
  // Replace multiple whitespace characters (including newlines) with a single space
  // Also, remove common OCR artifacts that might appear as stray characters
  return text.replace(/[\s\n\r]+/g, ' ')
    .replace(/[^a-zA-Z0-9.,!?;:'"()@#$%&*+=\-_/\\\[\]{}|\s]/g, '') // Remove non-standard characters
    .trim();
}

/**
 * Validates the cleaned text to ensure it's meaningful.
 * @param {string} text The cleaned text.
 * @returns {boolean} True if the text is considered valid.
 */
function isValidText(text) {
  if (!text || text.length < 20) return false; // Increased minimum length for more meaningful text
  // Check if the text contains a reasonable number of alphanumeric characters
  const alphaNumeric = text.match(/[a-zA-Z0-9]/g) || [];
  return alphaNumeric.length / text.length > 0.5; // Ensure at least 50% alphanumeric characters
}

/**
 * Refines the given text using Pollinations AI for spelling and grammar correction,
 * and *text fulfillment* for improperly extracted parts.
 * @param {string} text The text to refine.
 * @returns {Promise<string>} The refined text.
 */
async function refineTextWithPollinations(text) {
  // Enhanced prompt for Pollinations AI to include text fulfillment/completion
  const prompt = `You are an expert text corrector and completer.
  Given the following raw text, which may contain spelling errors, grammatical mistakes, incomplete words, or missing phrases due to OCR processing (especially from scanned documents or handwriting), your task is to:
  1. Correct all spelling and grammatical errors.
  2. Based on context, intelligently infer and complete any truncated or missing words/phrases. Do not hallucinate extensively, but make reasonable completions.
  3. If the text is not in English, translate it accurately into English while preserving the original meaning.
  4. Provide ONLY the corrected, completed, and translated text as a JSON object with a single key 'refined_text'.
  Do NOT include any introductory or concluding remarks, explanations, summaries, or any text outside the specified JSON format.

  Example of expected output:
  {"refined_text": "The quick brown fox jumps over the lazy dog."}

  Text to process: "${text}"`;
  try {
    const response = await axios.post(
      process.env.POLLINATIONS_API_URL,
      {
        messages: [{ role: 'user', content: prompt }],
        model: 'openai-fast', // Or another suitable model
        private: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    // Safely access the nested property
    const refinedText = response?.data?.refined_text;
    if (typeof refinedText === 'string') {
      return refinedText;
    } else {
      console.warn('Pollinations AI returned non-string or malformed response for refined_text, returning original text.');
      console.warn('Pollinations AI full response:', JSON.stringify(response.data)); // Log full response for debugging
      return text; // Return original text if refinement fails or response is not as expected
    }
  } catch (error) {
    console.error('Pollinations AI text refinement error:', error.message);
    return text; // Fallback to original text if API call fails
  }
}


/**
 * Predicts the document type using regex for high-confidence cases and Pollinations API for others.
 * @param {string} text The extracted text from the document.
 * @returns {Promise<string>} The predicted document type.
 */
async function predictDocumentType(text) {
  // High-confidence regex patterns for common Indian documents
  const patterns = {
    Aadhaar: /\b\d{4}\s?\d{4}\s?\d{4}\b|\bAADHAAR\b|\bUNIQUE\sIDENTIFICATION\sAUTHORITY\sOF\sINDIA\b|\bENROLLMENT\sNO\b/i,
    PAN: /\b[A-Z]{5}\d{4}[A-Z]\b|\bPERMANENT\sACCOUNT\sNUMBER\b|\bINCOME\sTAX\sDEPARTMENT\sINDIA\b/i,
    'Driving License': /\bDL\sNO\s*[A-Z]{2}\d{11,13}\b|\bDRIVING\sLICENCE\b|\bISSUING\sAUTHORITY\b|\bVALID\sTHRU\b/i,
    Passport: /\b[A-Z]\d{7}\b|\bPASSPORT\sNO\b|\bMINISTRY\sOF\sEXTERNAL\sAFFAIRS\b|\bINDIAN\sPASSPORT\b/i,
    'Bank Statement': /\bBANK\sSTATEMENT\b|\bA\/C\sNO\b.*?\d{9,18}\b|\bIFSC\sCODE\b.*?\w{4}\d{7}\b|\bSTATEMENT\sPERIOD\b/i,
    Invoice: /\bINVOICE\sNO\s*\w+\b|\bGSTIN\s*\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[Z][A-Z\d]\b|\bHSN\sCODE\b|\bTAX\sINVOICE\b/i,
    Marksheet: /\bMARK\sSHEET\b|\bROLL\sNO\s*\w+\b|\bBOARD\sOF\s.*\sEXAMINATION\b|\bMARKS\sOBTAINED\b/i,
    'Voter ID': /\bEPIC\sNO\s*[A-Z]{3}\d{7}\b|\bELECTOR\sPHOTO\sIDENTITY\sCARD\b|\bELECTION\sCOMMISSION\sOF\sINDIA\b/i,
    'Electricity Bill': /\bELECTRICITY\sBILL\b|\bCONSUMER\sNO\s*\d+\b|\bUNITS\sCONSUMED\b|\bBILL\sAMOUNT\b/i,
    'Utility Bill': /\b(WATER|GAS)\sBILL\b|\bCONSUMER\sID\s*\w+\b|\bBILLING\sPERIOD\s*\d{2}-\d{2}-\d{4}\b/i,
    'Birth Certificate': /\bBIRTH\sCERTIFICATE\b|\bREGISTRATION\sNO\s*\w+\b|\bDATE\sAND\sPLACE\sOF\sBIRTH\b/i,
    'Death Certificate': /\bDEATH\sCERTIFICATE\b|\bREGISTRATION\sNO\s*\w+\b|\bDATE\sAND\sPLACE\sOF\sDEATH\b/i,
    Resume: /\b(RESUME|CURRICULUM\sVITAE)\b|\bPROFESSIONAL\sEXPERIENCE\b|\bEDUCATIONAL\sQUALIFICATIONS\b/i,
    Contract: /\b(CONTRACT|AGREEMENT)\sNO\s*\w+\b|\bPARTIES\sTO\sTHE\sAGREEMENT\b|\bEXECUTED\sON\b/i,
    Prescription: /\bPRESCRIPTION\b|\bRX\sNO\s*\w+\b|\bMEDICATION\s.*DOSAGE\b|\bPHYSICIAN\sNAME\b/i,
    Receipt: /\bRECEIPT\sNO\s*\w+\b|\bPAID\sAMOUNT\s*[\d,.]+\b|\bPURCHASE\sDATE\s*\d{2}-\d{2}-\d{4}\b/i,
    'Bank Passbook': /\bPASSBOOK\b|\bACCOUNT\sHOLDER\sNAME\b|\bIFSC\sCODE\s*\w{4}\d{7}\b|\bBRANCH\sADDRESS\b/i,
    'School ID': /\bSCHOOL\sID\sCARD\b|\bSTUDENT\sID\s*\w+\b|\bACADEMIC\sSESSION\b/i,
    'Employee ID': /\bEMPLOYEE\sID\s*\w+\b|\bDESIGNATION\s.*\b|\bEMPLOYEE\sCODE\b/i,
    'Property Document': /\b(SALE\sDEED|PROPERTY\sDOCUMENT)\b|\bKHASRA\sNO\b|\bREGISTRATION\sDATE\s*\d{2}-\d{2}-\d{4}\b/i,
    'Court Order': /\bCOURT\sORDER\b|\bCASE\sNO\s*\w+\b|\bJUDGMENT\sDATE\s*\d{2}-\d{2}-\d{4}\b|\bHIGH\sCOURT\b/i,
  };

  for (const [type, regex] of Object.entries(patterns)) {
    if (regex.test(text)) {
      return type;
    }
  }

  // Fallback to Pollinations API for broader classification
  const prompt = `Analyze the following text and identify the most likely document type from a broad range of possibilities. Examples include "Passport", "Driving License", "Bank Statement", "Invoice", "Marksheet", "Aadhaar", "PAN", "Voter ID", "Electricity Bill", "Utility Bill", "Birth Certificate", "Death Certificate", "Resume", "Contract", "Prescription", "Receipt", "Bank Passbook", "School ID", "Employee ID", "Property Document", "Court Order","Driving License". Provide ONLY the document type as a JSON object, like {"document_type": "Passport"}. Do NOT include any other text or prose in the response. Text: "${text}"`;

  try {
    const response = await axios.post(
      process.env.POLLINATIONS_API_URL,
      {
        messages: [{ role: 'user', content: prompt }],
        model: 'openai-fast', // Or another suitable model
        private: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    // Safely access the nested property and ensure it's a string
    const documentType = response?.data?.document_type;
    if (typeof documentType === 'string') {
      return documentType;
    } else {
      console.warn('Pollinations AI returned non-string or malformed response for document_type, defaulting to "Unknown Document".');
      console.warn('Pollinations AI full response:', JSON.stringify(response.data)); // Log full response for debugging
      return 'Unknown Document';
    }
  } catch (error) {
    console.error('Pollinations API document type prediction error:', error.message);
    return 'Unknown Document'; // Default if API fails
  }
}

/**
 * Ensures the required Tesseract traineddata files are available in the /tmp directory.
 * This is optimized for serverless environments.
 * @param {string} languages A '+' separated string of languages (e.g., 'eng+tam+hin').
 */
async function ensureTrainedData(languages) {
  await fs.mkdir(TESSDATA_PATH, { recursive: true });

  const requiredFiles = ['osd', ...languages.split('+')];
  for (const lang of requiredFiles) {
    const filePath = path.join(TESSDATA_PATH, `${lang}.traineddata`);
    try {
      await fs.access(filePath); // Check if file already exists
    } catch {
      try {
        console.log(`Downloading ${lang}.traineddata...`);
        // Special handling for osd if it causes issues with tessdata_fast
        const url = lang === 'osd'
          ? `https://github.com/tesseract-ocr/tessdata/raw/main/${lang}.traineddata` // Use tessdata for OSD
          : `https://github.com/tesseract-ocr/tessdata_fast/raw/main/${lang}.traineddata`; // Use tessdata_fast for languages

        const response = await axios.get(url, { responseType: 'arraybuffer' });
        await fs.writeFile(filePath, response.data);
        console.log(`Successfully downloaded ${lang}.traineddata.`);
      } catch (downloadError) {
        console.error(`Failed to download ${lang}.traineddata:`, downloadError.message);
        throw new Error(`Could not initialize OCR engine: Missing language file for '${lang}'`);
      }
    }
  }
}

/**
 * Main function to process an image buffer for OCR.
 * @param {Buffer} inputBuffer The raw image buffer.
 * @param {string} languages A '+' separated string of languages (e.g., 'eng+tam+hin').
 * @returns {Promise<{text: string, refined_text: string, document_type: string}>} The OCR results.
 */
async function processImage(inputBuffer, languages) {
  // Validate input buffer
  if (!inputBuffer || !Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
    console.error('Input buffer is invalid or empty');
    throw new Error('Invalid image buffer');
  }
  if (inputBuffer.length > 50 * 1024 * 1024) {
    console.error(`Input buffer size (${(inputBuffer.length / 1024 / 1024).toFixed(2)}MB) exceeds 50MB limit`);
    throw new Error('Image size exceeds 50MB limit');
  }
  console.log(`Input buffer size: ${(inputBuffer.length / 1024 / 1024).toFixed(2)}MB`);

  // Ensure language files
  console.log(`Ensuring traineddata files for languages: ${languages}`);
  try {
    process.env.TESSDATA_PREFIX = TESSDATA_PATH; // Set early
    await ensureTrainedData(languages);
    console.log(`TESSDATA_PREFIX set to ${TESSDATA_PATH}`);

    // Verify language files
    const langFiles = languages.split('+').map(lang => `${lang}.traineddata`);
    for (const file of langFiles) {
      const filePath = path.join(TESSDATA_PATH, file);
      const stats = await fs.stat(filePath).catch(() => null);
      if (!stats || stats.size < 1000) {
        console.warn(`${file} missing or corrupted at ${filePath} (size: ${stats?.size || 0} bytes)`);
      } else {
        console.log(`${file} found, size: ${(stats.size / 1024).toFixed(2)}KB`);
      }
    }
  } catch (error) {
    console.error('Failed to ensure traineddata files:', error.message);
  }

  // Preprocess image
  console.log('Starting image preprocessing');
  let processedBuffer;
  try {
    processedBuffer = await sharp(inputBuffer)
      .metadata()
      .then(({ width, height, format }) => {
        if (!width || !height || width <= 0 || height <= 0) {
          console.error(`Invalid image dimensions: ${width}x${height}`);
          throw new Error('Invalid image dimensions');
        }
        if (!['jpeg', 'png'].includes(format)) {
          console.error(`Unsupported image format: ${format}`);
          throw new Error('Unsupported image format');
        }
        console.log(`Input image: ${width}x${height}, format: ${format}`);
        return sharp(inputBuffer)
          .grayscale()
          .resize({ width: Math.min(width, 1200), height: Math.min(height, 1200), withoutEnlargement: true })
          .linear(1.2, 0) // Increase contrast for camera images
          .sharpen({ sigma: 1, m1: 0, m2: 2 }) // Softer sharpening
          .median(2) // Light noise reduction
          .toBuffer();
      });
    if (!processedBuffer || processedBuffer.length < 1000) {
      console.error(`Preprocessed buffer invalid (size: ${processedBuffer?.length || 0} bytes)`);
      throw new Error('Invalid preprocessed image');
    }
    console.log(`Primary preprocessing completed, output size: ${(processedBuffer.length / 1024).toFixed(2)}KB`);
  } catch (error) {
    console.error('Primary preprocessing failed:', error.message);
    try {
      // Fallback preprocessing for camera images
      processedBuffer = await sharp(inputBuffer)
        .grayscale()
        .resize({ width: 1200, withoutEnlargement: true })
        .linear(1.5, 0) // Stronger contrast for low-light camera images
        .toBuffer();
      console.log(`Fallback preprocessing applied (grayscale + contrast), output size: ${(processedBuffer.length / 1024).toFixed(2)}KB`);
    } catch (fallbackError) {
      console.error('Fallback preprocessing failed:', fallbackError.message);
      processedBuffer = inputBuffer; // Use original buffer
      console.log('Using original buffer as fallback');
    }
  }

  // FOR DEBUGGING ONLY: Save processed image
  // try {
  //   const debugPath = path.join('/tmp', `processed_image_${Date.now()}.png`);
  //   await fs.writeFile(debugPath, processedBuffer);
  //   console.log(`Processed image saved to ${debugPath}`);
  // } catch (error) {
  //   console.error('Failed to save debug image:', error.message);
  // }

  let worker;
  let extractedText = '';
  let refinedText = '';
  let documentType = 'Unknown Document';
  const psmModes = [
    { mode: Tesseract.PSM.AUTO, name: 'AUTO' },
    { mode: Tesseract.PSM.SPARSE_TEXT, name: 'SPARSE_TEXT' },
    { mode: Tesseract.PSM.SINGLE_BLOCK, name: 'SINGLE_BLOCK' },
    { mode: Tesseract.PSM.SINGLE_BLOCK_VERT_TEXT, name: 'SINGLE_BLOCK_VERT_TEXT' },
  ];
  const oemModes = [
    { oem: Tesseract.OEM.LSTM_ONLY, name: 'LSTM_ONLY' },
    { oem: Tesseract.OEM.TESSERACT_LSTM_COMBINED, name: 'TESSERACT_LSTM_COMBINED' },
  ];

  // Try OCR with preprocessed buffer
  for (let oemIdx = 0; oemIdx < oemModes.length && !extractedText; oemIdx++) {
    const { oem, oemName } = oemModes[oemIdx];
    for (let i = 0; i < psmModes.length && !extractedText; i++) {
      const { mode, name } = psmModes[i];
      console.log(`Attempting OCR with OEM: ${oemName}, PSM mode: ${name} (preprocessed buffer)`);

      try {
        worker = await Tesseract.createWorker(languages, oem, {
          cachePath: TESSDATA_PATH,
          tessdataPath: TESSDATA_PATH,
          load_system_dawg: false,
          load_freq_dawg: false,
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`Tesseract progress (${oemName}, ${name}): ${Math.round(m.progress * 100)}%`);
            }
            if (m.status.includes('loading') || m.status.includes('initializing')) {
              console.log(`Tesseract status: ${m.status}`);
            }
          },
        });

        await worker.setParameters({
          tessedit_pageseg_mode: mode,
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -.,/:()&அஆஇஈஉஊஎஏஐஒஓஔகஙசஜஞடணதநபமயரலவழளனரலகஷஸஹ', // Include Tamil characters
          preserve_interword_spaces: '1',
          tessedit_do_invert: '0', // Prevent inversion issues
        });

        const { data } = await worker.recognize(processedBuffer);
        console.log(`Tesseract OCR (${oemName}, ${name}) completed. Confidence: ${data.confidence}%, Words: ${data.words?.length || 0}, Blocks: ${data.blocks?.length || 0}`);

        if (!data.text || !data.text.trim()) {
          console.warn(`No text detected with OEM: ${oemName}, PSM mode: ${name}`);
          throw new Error('No text detected');
        }

        extractedText = cleanText(data.text);
        if (!isValidText(extractedText)) {
          console.warn(`Extracted text invalid with OEM: ${oemName}, PSM mode: ${name}: "${extractedText}"`);
          throw new Error('Extracted text too short or invalid');
        }

        console.log(`Extracted text (${oemName}, ${name}): "${extractedText}"`);
        break; // Success, exit loop
      } catch (error) {
        console.error(`OCR failed with OEM: ${oemName}, PSM mode: ${name}: ${error.message}`);
      } finally {
        if (worker) {
          console.log(`Terminating Tesseract worker for OEM: ${oemName}, PSM: ${name}`);
          await worker.terminate();
        }
      }
    }
  }

  // Fallback OCR with original buffer
  if (!extractedText) {
    console.log('Attempting OCR with original buffer');
    for (let oemIdx = 0; oemIdx < oemModes.length && !extractedText; oemIdx++) {
      const { oem, oemName } = oemModes[oemIdx];
      for (let i = 0; i < psmModes.length && !extractedText; i++) {
        const { mode, name } = psmModes[i];
        console.log(`Attempting OCR with OEM: ${oemName}, PSM mode: ${name} (original buffer)`);

        try {
          worker = await Tesseract.createWorker(languages, oem, {
            cachePath: TESSDATA_PATH,
            tessdataPath: TESSDATA_PATH,
            load_system_dawg: false,
            load_freq_dawg: false,
            logger: (m) => {
              if (m.status === 'recognizing text') {
                console.log(`Tesseract progress (${oemName}, ${name}): ${Math.round(m.progress * 100)}%`);
              }
              if (m.status.includes('loading') || m.status.includes('initializing')) {
                console.log(`Tesseract status: ${m.status}`);
              }
            },
          });

          await worker.setParameters({
            tessedit_pageseg_mode: mode,
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -.,/:()&அஆஇஈஉஊஎஏஐஒஓஔகஙசஜஞடணதநபமயரலவழளனரலகஷஸஹ',
            preserve_interword_spaces: '1',
            tessedit_do_invert: '0',
          });

          const { data } = await worker.recognize(inputBuffer);
          console.log(`Tesseract OCR (${oemName}, ${name}) completed (original buffer). Confidence: ${data.confidence}%, Words: ${data.words?.length || 0}, Blocks: ${data.blocks?.length || 0}`);

          if (!data.text || !data.text.trim()) {
            console.warn(`No text detected with OEM: ${oemName}, PSM mode: ${name} (original buffer)`);
            throw new Error('No text detected');
          }

          extractedText = cleanText(data.text);
          if (!isValidText(extractedText)) {
            console.warn(`Extracted text invalid with OEM: ${oemName}, PSM mode: ${name} (original buffer): "${extractedText}"`);
            throw new Error('Extracted text too short or invalid');
          }

          console.log(`Extracted text (${oemName}, ${name}, original buffer): "${extractedText}"`);
          break; // Success, exit loop
        } catch (error) {
          console.error(`OCR failed with OEM: ${oemName}, PSM mode: ${name} (original buffer): ${error.message}`);
          if (oemIdx === oemModes.length - 1 && i === psmModes.length - 1) {
            throw new Error(`All OCR attempts failed: ${error.message}`);
          }
        } finally {
          if (worker) {
            console.log(`Terminating Tesseract worker for OEM: ${oemName}, PSM: ${name} (original buffer)`);
            await worker.terminate();
          }
        }
      }
    }
  }

  try {
    console.log('Refining extracted text with Pollinations AI');
    refinedText = await refineTextWithPollinations(extractedText);
    console.log(`Refined text: "${refinedText}"`);

    console.log('Predicting document type');
    documentType = await predictDocumentType(refinedText);
    console.log(`Predicted document type: ${documentType}`);

    return {
      text: extractedText,
      refined_text: refinedText,
      document_type: documentType,
    };
  } catch (error) {
    console.error('Post-processing error:', error.message);
    throw new Error(`Failed to refine or classify text: ${error.message}`);
  }
}

/**
 * Controller to extract text from a base64 encoded image.
 * Responds with a schema: { text: string, refined_text: string, document_type: string }
 */
async function extractTextFromBase64V2(req, res) {
  const { base64, languages = 'eng+tam+hin' } = req.body;

  if (!base64) {
    return res.status(400).json({ error: 'Missing "base64" in request body.' });
  }
  if (!isValidBase64Image(base64)) {
    return res.status(400).json({ error: 'Invalid base64 image format. Must start with "data:image/..."' });
  }

  const cacheKey = `ocr_base64_${languages}_${base64.substring(0, 100)}`; // Use a prefix for base64 to avoid collision
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  try {
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const result = await processImage(buffer, languages);

    cache.set(cacheKey, result);
    res.status(200).json(result);
  } catch (error) {
    console.error('Base64 text extraction error:', error.message);
    res.status(500).json({ error: `Failed to extract text. Reason: ${error.message}` });
  }
}

/**
 * Controller to extract text from an uploaded image file.
 * Responds with a schema: { text: string, refined_text: string, document_type: string }
 */
async function extractTextFromImageV2(req, res) {
  const imageFile = req.file;
  const languages = req.body.languages || 'eng+tam+hin';

  if (!imageFile) {
    return res.status(400).json({ error: 'Missing image file in request.' });
  }

  const cacheKey = `ocr_file_${languages}_${imageFile.filename}`; // Use a prefix for file to avoid collision
  const cached = cache.get(cacheKey);
  if (cached) {
    // Clean up uploaded file even if result is cached
    await fs.unlink(imageFile.path).catch(err => console.error("Error deleting cached file:", err.message));
    return res.status(200).json(cached);
  }

  try {
    const buffer = await fs.readFile(imageFile.path);
    const result = await processImage(buffer, languages);

    cache.set(cacheKey, result);
    res.status(200).json(result);
  } catch (error) {
    console.error('Image file extraction error:', error.message);
    res.status(500).json({ error: `Failed to extract text from image. Reason: ${error.message}` });
  } finally {
    // Clean up the uploaded file from the /tmp directory
    await fs.unlink(imageFile.path).catch(err => console.error("Error deleting file:", err.message));
  }
}

module.exports = { extractTextFromBase64V2, extractTextFromImageV2, uploadV2 };