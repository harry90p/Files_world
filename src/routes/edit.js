const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const { upload } = require('../middleware/upload');
const { createJobDir, moveUploadsToJob } = require('../services/fileManager');
const { annotatePdf } = require('../services/pdfService');
const { runOcr } = require('../services/ocrService');
const { buildDownloadUrl } = require('../utils/routeHelpers');

const router = require('express').Router();

router.post('/', upload.array('files', 1), async (req, res, next) => {
  try {
    const { dir } = await createJobDir();
    const [file] = await moveUploadsToJob(req.files || [], dir);
    if (!file) throw new Error('Upload one file to edit.');

    const mode = String(req.body.mode || 'annotate').toLowerCase();
    const ext = path.extname(file.movedPath).toLowerCase();
    let outputPath;

    if (mode === 'ocr') {
      const ocr = await runOcr(file.movedPath, dir, req.body.lang || 'eng');
      outputPath = ocr.pdfPath;
    } else if (mode === 'text-replace' && ['.txt', '.md', '.csv'].includes(ext)) {
      const source = await fs.readFile(file.movedPath, 'utf-8');
      const find = String(req.body.find || '');
      const replace = String(req.body.replace || '');
      outputPath = path.join(dir, 'edited.txt');
      await fs.writeFile(outputPath, source.replaceAll(find, replace), 'utf-8');
    } else {
      outputPath = path.join(dir, 'annotated.pdf');
      await annotatePdf(file.movedPath, outputPath, req.body.note || 'Edited via Files World');
    }

    req.logAction?.('edit', { mode, ext });
    res.json({ ok: true, message: 'Editing complete.', downloadUrl: buildDownloadUrl(dir, outputPath) });
  } catch (err) {
    err.publicMessage = err.publicMessage || err.message;
    next(err);
  }
});

module.exports = router;
