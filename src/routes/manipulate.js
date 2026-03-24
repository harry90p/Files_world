const path = require('path');
const sharp = require('sharp');
const { upload } = require('../middleware/upload');
const { createJobDir, moveUploadsToJob } = require('../services/fileManager');
const {
  rotatePdf,
  cropPdf,
  watermarkPdf,
  encryptFile,
  decryptFile,
  extractPages,
  extractTextFromPdf,
} = require('../services/pdfService');
const { parseCsvList, buildDownloadUrl } = require('../utils/routeHelpers');

const router = require('express').Router();

router.post('/', upload.array('files', 1), async (req, res, next) => {
  try {
    const { dir } = await createJobDir();
    const [file] = await moveUploadsToJob(req.files || [], dir);
    if (!file) throw new Error('Upload one file to manipulate.');

    const op = String(req.body.operation || 'rotate').toLowerCase();
    const ext = path.extname(file.movedPath).toLowerCase();
    let outputPath = path.join(dir, 'output.bin');

    if (op === 'rotate') {
      if (ext === '.pdf') {
        outputPath = path.join(dir, 'rotated.pdf');
        await rotatePdf(file.movedPath, outputPath, Number(req.body.angle || 90));
      } else {
        outputPath = path.join(dir, 'rotated.jpg');
        await sharp(file.movedPath).rotate(Number(req.body.angle || 90)).toFile(outputPath);
      }
    } else if (op === 'crop') {
      if (ext === '.pdf') {
        outputPath = path.join(dir, 'cropped.pdf');
        await cropPdf(file.movedPath, outputPath, Number(req.body.factor || 0.9));
      } else {
        outputPath = path.join(dir, 'cropped.jpg');
        const m = await sharp(file.movedPath).metadata();
        await sharp(file.movedPath).extract({ left: 10, top: 10, width: Math.max(10, (m.width || 200) - 20), height: Math.max(10, (m.height || 200) - 20) }).toFile(outputPath);
      }
    } else if (op === 'watermark') {
      outputPath = path.join(dir, 'watermarked.pdf');
      await watermarkPdf(file.movedPath, outputPath, req.body.text || 'Files World');
    } else if (op === 'encrypt') {
      outputPath = path.join(dir, 'encrypted.bin');
      await encryptFile(file.movedPath, outputPath, String(req.body.passphrase || 'demo-passphrase'));
    } else if (op === 'decrypt') {
      outputPath = path.join(dir, 'decrypted.bin');
      await decryptFile(file.movedPath, outputPath, String(req.body.passphrase || 'demo-passphrase'));
    } else if (op === 'extract-pages') {
      outputPath = path.join(dir, 'extracted.pdf');
      await extractPages(file.movedPath, outputPath, parseCsvList(req.body.pages));
    } else if (op === 'extract-text') {
      outputPath = path.join(dir, 'extracted.txt');
      await extractTextFromPdf(file.movedPath, outputPath);
    } else {
      throw new Error(`Unknown manipulation operation: ${op}`);
    }

    req.logAction?.('manipulate', { operation: op, ext });
    res.json({ ok: true, message: 'Manipulation complete.', downloadUrl: buildDownloadUrl(dir, outputPath) });
  } catch (err) {
    err.publicMessage = err.publicMessage || err.message;
    next(err);
  }
});

module.exports = router;
