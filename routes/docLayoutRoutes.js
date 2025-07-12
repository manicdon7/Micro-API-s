const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const mammoth = require('mammoth'); // ✅ DOCX
const XLSX = require('xlsx');       // ✅ XLS/XLSX

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'outputs/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage });

router.post('/convert-doc', upload.single('document'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const filePath = req.file.path;
  const ext = path.extname(filePath).toLowerCase();
  const outputFilename = `${Date.now()}-converted.pdf`;
  const outputPath = path.join('outputs', outputFilename);

  try {
    let htmlContent = '';

    // ✅ .docx → HTML
    if (ext === '.docx') {
      const result = await mammoth.convertToHtml({ path: filePath });
      htmlContent = result.value;
    }

    // ✅ .html or .txt → HTML
    else if (ext === '.html' || ext === '.txt') {
      htmlContent = fs.readFileSync(filePath, 'utf8');
    }

    // ✅ .xls / .xlsx → HTML table
    else if (ext === '.xls' || ext === '.xlsx') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      htmlContent = `<h2>${sheetName}</h2><table border="1" cellspacing="0" cellpadding="5">`;
      json.forEach(row => {
        htmlContent += '<tr>';
        row.forEach(cell => {
          htmlContent += `<td>${cell ?? ''}</td>`;
        });
        htmlContent += '</tr>';
      });
      htmlContent += '</table>';
    }

    // ❌ Unsupported
    else {
      return res.status(400).json({ error: 'Only .html, .txt, .docx, .xls, and .xlsx are supported' });
    }

    // ✅ Generate PDF using Puppeteer
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'load' });

    await page.pdf({ path: outputPath, format: 'A4' });
    await browser.close();

    res.json({
      message: 'Document converted to PDF',
      url: `/outputs/${outputFilename}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Conversion failed' });
  }
});

module.exports = router;
