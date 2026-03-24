const fs = require('fs/promises');
const path = require('path');
const Tesseract = require('tesseract.js');
const { textToPdf } = require('./pdfService');

async function runOcr(inputPath, outputDir, lang = 'eng') {
  const result = await Tesseract.recognize(inputPath, lang, {
    logger: () => undefined,
    tessedit_pageseg_mode: Tesseract.PSM.AUTO,
  });

  const text = result?.data?.text || '';
  const txtPath = path.join(outputDir, 'ocr_text.txt');
  const pdfPath = path.join(outputDir, 'ocr_editable.pdf');
  await fs.writeFile(txtPath, text, 'utf-8');
  await textToPdf(text, pdfPath, 'AI OCR Editable Output');
  return { txtPath, pdfPath, textLength: text.length };
}

module.exports = {
  runOcr,
};
