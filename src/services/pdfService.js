const fs = require('fs/promises');
const path = require('path');
const { createWriteStream } = require('fs');
const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib');
const PDFKit = require('pdfkit');
const sharp = require('sharp');
const archiver = require('archiver');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const crypto = require('crypto');
const pdfParse = require('pdf-parse');

async function mergePdfs(inputPaths, outputPath) {
  const merged = await PDFDocument.create();
  for (const input of inputPaths) {
    const source = await PDFDocument.load(await fs.readFile(input));
    const copied = await merged.copyPages(source, source.getPageIndices());
    copied.forEach((p) => merged.addPage(p));
  }
  await fs.writeFile(outputPath, await merged.save());
  return outputPath;
}

async function mergeFilesAsZip(inputPaths, outputPath) {
  await new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    inputPaths.forEach((p) => archive.file(p, { name: path.basename(p) }));
    archive.finalize();
  });
  return outputPath;
}

async function splitPdf(inputPath, outputDir, ranges = []) {
  const doc = await PDFDocument.load(await fs.readFile(inputPath));
  const total = doc.getPageCount();
  const segments = ranges.length ? ranges : Array.from({ length: total }, (_, i) => `${i + 1}-${i + 1}`);
  const outputs = [];
  for (const [i, r] of segments.entries()) {
    const [start, end] = r.split('-').map(Number);
    if (!start || !end || start > end || start < 1 || end > total) continue;
    const out = await PDFDocument.create();
    const idxs = Array.from({ length: end - start + 1 }, (_, n) => start - 1 + n);
    const pages = await out.copyPages(doc, idxs);
    pages.forEach((p) => out.addPage(p));
    const output = path.join(outputDir, `segment_${i + 1}_${start}-${end}.pdf`);
    await fs.writeFile(output, await out.save());
    outputs.push(output);
  }
  return outputs;
}

async function splitText(inputPath, outputDir, chunkSize = 1000) {
  const text = await fs.readFile(inputPath, 'utf-8');
  const outputs = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    const partPath = path.join(outputDir, `chunk_${Math.floor(i / chunkSize) + 1}.txt`);
    await fs.writeFile(partPath, text.slice(i, i + chunkSize));
    outputs.push(partPath);
  }
  return outputs;
}

async function compressPdf(inputPath, outputPath) {
  const doc = await PDFDocument.load(await fs.readFile(inputPath));
  await fs.writeFile(outputPath, await doc.save({ useObjectStreams: true, addDefaultPage: false }));
  return outputPath;
}

async function compressImage(inputPath, outputPath) {
  await sharp(inputPath).jpeg({ mozjpeg: true, quality: 90 }).toFile(outputPath);
  return outputPath;
}

async function compressGeneric(inputPath, outputPath) {
  await pipeline(require('fs').createReadStream(inputPath), zlib.createGzip(), require('fs').createWriteStream(outputPath));
  return outputPath;
}

async function rotatePdf(inputPath, outputPath, angle) {
  const doc = await PDFDocument.load(await fs.readFile(inputPath));
  doc.getPages().forEach((p) => p.setRotation(degrees(Number(angle) || 90)));
  await fs.writeFile(outputPath, await doc.save());
  return outputPath;
}

async function cropPdf(inputPath, outputPath, factor = 0.9) {
  const doc = await PDFDocument.load(await fs.readFile(inputPath));
  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    page.setCropBox(width * ((1 - factor) / 2), height * ((1 - factor) / 2), width * factor, height * factor);
  });
  await fs.writeFile(outputPath, await doc.save());
  return outputPath;
}

async function watermarkPdf(inputPath, outputPath, text = 'Files World') {
  const doc = await PDFDocument.load(await fs.readFile(inputPath));
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.getPages().forEach((p) => {
    const { width, height } = p.getSize();
    p.drawText(text, { x: width * 0.1, y: height * 0.5, size: Math.max(24, width / 14), font, rotate: degrees(35), color: rgb(0.6, 0.6, 0.6), opacity: 0.3 });
  });
  await fs.writeFile(outputPath, await doc.save());
  return outputPath;
}

async function annotatePdf(inputPath, outputPath, note) {
  const doc = await PDFDocument.load(await fs.readFile(inputPath));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.getPages().forEach((p, i) => {
    const { width, height } = p.getSize();
    p.drawRectangle({ x: 16, y: height - 64, width: width - 32, height: 42, color: rgb(1, 0.95, 0.7), opacity: 0.9 });
    p.drawText(`Annotation ${i + 1}: ${note}`, { x: 22, y: height - 40, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
  });
  await fs.writeFile(outputPath, await doc.save());
  return outputPath;
}

async function extractPages(inputPath, outputPath, pages) {
  const doc = await PDFDocument.load(await fs.readFile(inputPath));
  const out = await PDFDocument.create();
  const total = doc.getPageCount();
  const idxs = pages.map((v) => Number(v) - 1).filter((v) => Number.isInteger(v) && v >= 0 && v < total);
  const copied = await out.copyPages(doc, idxs);
  copied.forEach((p) => out.addPage(p));
  await fs.writeFile(outputPath, await out.save());
  return outputPath;
}

async function extractTextFromPdf(inputPath, outputPath) {
  const data = await pdfParse(await fs.readFile(inputPath));
  await fs.writeFile(outputPath, data.text || '');
  return outputPath;
}

async function extractImageToPdf(inputPaths, outputPath) {
  const doc = await PDFDocument.create();
  for (const p of inputPaths) {
    const meta = await sharp(p).metadata();
    const imgBuf = await sharp(p).jpeg({ quality: 95 }).toBuffer();
    const embedded = await doc.embedJpg(imgBuf);
    const page = doc.addPage([meta.width || 1000, meta.height || 1000]);
    page.drawImage(embedded, { x: 0, y: 0, width: meta.width || 1000, height: meta.height || 1000 });
  }
  await fs.writeFile(outputPath, await doc.save());
  return outputPath;
}

async function textToPdf(text, outputPath, title = 'Converted Document') {
  await new Promise((resolve, reject) => {
    const doc = new PDFKit({ margin: 50 });
    const stream = createWriteStream(outputPath);
    doc.pipe(stream);
    doc.fontSize(20).text(title);
    doc.moveDown();
    doc.fontSize(12).text(text || 'No content detected.');
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
  return outputPath;
}

async function encryptFile(inputPath, outputPath, passphrase) {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(passphrase).digest();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  await pipeline(require('fs').createReadStream(inputPath), cipher, require('fs').createWriteStream(outputPath));
  await fs.appendFile(outputPath, iv.toString('hex'));
  return outputPath;
}

async function decryptFile(inputPath, outputPath, passphrase) {
  const all = await fs.readFile(inputPath);
  const ivHex = all.slice(-32).toString();
  const iv = Buffer.from(ivHex, 'hex');
  const payload = all.slice(0, -32);
  const key = crypto.createHash('sha256').update(passphrase).digest();
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
  await fs.writeFile(outputPath, decrypted);
  return outputPath;
}

module.exports = {
  mergePdfs,
  mergeFilesAsZip,
  splitPdf,
  splitText,
  compressPdf,
  compressImage,
  compressGeneric,
  rotatePdf,
  cropPdf,
  watermarkPdf,
  annotatePdf,
  extractPages,
  extractTextFromPdf,
  extractImageToPdf,
  textToPdf,
  encryptFile,
  decryptFile,
};
