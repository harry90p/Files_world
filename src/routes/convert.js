const express = require('express');
const path = require('path');
const { upload } = require('../middleware/upload');
const { createJobDir, moveUploadsToJob } = require('../services/fileManager');
const { convertToPdf, convertFromPdf } = require('../services/conversionService');
const { buildDownloadUrl } = require('../utils/routeHelpers');

const router = express.Router();

router.post('/', upload.array('files', 1), async (req, res, next) => {
  try {
    const { dir } = await createJobDir();
    const [file] = await moveUploadsToJob(req.files || [], dir);
    if (!file) throw new Error('Upload one file to convert.');

    const ext = path.extname(file.movedPath).toLowerCase();
    const target = String(req.body.targetFormat || 'pdf').toLowerCase();
    const outputPath = path.join(dir, `converted.${target}`);

    if (ext === '.pdf') await convertFromPdf(file.movedPath, outputPath, target);
    else if (target === 'pdf') await convertToPdf(file.movedPath, outputPath);
    else throw new Error('Only conversions to PDF or from PDF are supported in this endpoint.');

    req.logAction?.('convert', { ext, target });
    res.json({ ok: true, message: 'Conversion complete.', downloadUrl: buildDownloadUrl(dir, outputPath) });
  } catch (err) {
    err.publicMessage = err.publicMessage || err.message;
    next(err);
  }
});

module.exports = router;
