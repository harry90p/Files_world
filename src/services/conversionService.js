const fs = require('fs/promises');
const path = require('path');
const libre = require('libreoffice-convert');
const mammoth = require('mammoth');
const { textToPdf, extractImageToPdf } = require('./pdfService');

libre.convertAsync = require('util').promisify(libre.convert);

async function convertOffice(inputPath, outputPath, targetExt) {
  const content = await fs.readFile(inputPath);
  const converted = await libre.convertAsync(content, targetExt, undefined);
  await fs.writeFile(outputPath, converted);
  return outputPath;
}

async function convertToPdf(inputPath, outputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  if (['.pdf'].includes(ext)) {
    await fs.copyFile(inputPath, outputPath);
    return outputPath;
  }

  if (['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff'].includes(ext)) {
    return extractImageToPdf([inputPath], outputPath);
  }

  if (['.txt', '.md', '.csv'].includes(ext)) {
    return textToPdf(await fs.readFile(inputPath, 'utf-8'), outputPath, `Converted from ${ext.toUpperCase()}`);
  }

  if (['.docx', '.xlsx', '.pptx', '.odt', '.ods', '.odp'].includes(ext)) {
    try {
      return await convertOffice(inputPath, outputPath, '.pdf');
    } catch (err) {
      if (ext === '.docx') {
        const extracted = await mammoth.extractRawText({ path: inputPath });
        return textToPdf(extracted.value, outputPath, 'DOCX Fallback Conversion');
      }
      err.publicMessage = 'Server-side office conversion requires LibreOffice installation.';
      throw err;
    }
  }

  const error = new Error(`Unsupported conversion to PDF from ${ext}`);
  error.publicMessage = error.message;
  throw error;
}

async function convertFromPdf(inputPath, outputPath, targetFormat) {
  const format = targetFormat.toLowerCase();
  if (['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp'].includes(format)) {
    return convertOffice(inputPath, outputPath, `.${format}`);
  }
  if (['txt', 'md'].includes(format)) {
    const pdfParse = require('pdf-parse');
    const parsed = await pdfParse(await fs.readFile(inputPath));
    await fs.writeFile(outputPath, parsed.text || '');
    return outputPath;
  }

  const error = new Error(`Unsupported conversion from PDF to ${format}`);
  error.publicMessage = error.message;
  throw error;
}

module.exports = {
  convertToPdf,
  convertFromPdf,
};
