const express = require('express');
const path = require('path');
const { upload } = require('../middleware/upload');
const { createJobDir, moveUploadsToJob } = require('../services/fileManager');
const { compressPdf, compressImage, compressGeneric } = require('../services/pdfService');
const { buildDownloadUrl } = require('../utils/routeHelpers');

const router = express.Router();

router.post('/', upload.array('files', 1), async (req, res, next) => {
  try {
    const { dir } = await createJobDir();
    const [file] = await moveUploadsToJob(req.files || [], dir);
    if (!file) throw new Error('Upload one file to compress.');

    const ext = path.extname(file.movedPath).toLowerCase();
    const outputPath = path.join(dir, `compressed${ext === '.pdf' ? '.pdf' : ext + '.gz'}`);

    if (ext === '.pdf') await compressPdf(file.movedPath, outputPath);
    else if (['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff'].includes(ext)) {
      await compressImage(file.movedPath, path.join(dir, 'compressed.jpg'));
    } else {
      await compressGeneric(file.movedPath, outputPath);
    }

    const finalPath = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff'].includes(ext)
      ? path.join(dir, 'compressed.jpg')
      : outputPath;

    req.logAction?.('compress', { ext });
    res.json({ ok: true, message: 'Compression completed.', downloadUrl: buildDownloadUrl(dir, finalPath) });
  } catch (err) {
    err.publicMessage = err.publicMessage || err.message;
    next(err);
  }
});

module.exports = router;
