const express = require('express');
const path = require('path');
const { upload } = require('../middleware/upload');
const { createJobDir, moveUploadsToJob } = require('../services/fileManager');
const { mergePdfs, mergeFilesAsZip } = require('../services/pdfService');
const { buildDownloadUrl } = require('../utils/routeHelpers');

const router = express.Router();

router.post('/', upload.array('files', 30), async (req, res, next) => {
  try {
    const { dir } = await createJobDir();
    const files = await moveUploadsToJob(req.files || [], dir);
    if (files.length < 2) throw new Error('Please upload at least two files to merge.');

    const allPdf = files.every((f) => path.extname(f.movedPath).toLowerCase() === '.pdf');
    const outputPath = path.join(dir, allPdf ? 'merged.pdf' : 'merged_bundle.zip');
    if (allPdf) await mergePdfs(files.map((f) => f.movedPath), outputPath);
    else await mergeFilesAsZip(files.map((f) => f.movedPath), outputPath);

    req.logAction?.('merge', { count: files.length, mode: allPdf ? 'pdf' : 'zip' });
    res.json({ ok: true, message: 'Merge completed.', downloadUrl: buildDownloadUrl(dir, outputPath) });
  } catch (err) {
    err.publicMessage = err.publicMessage || err.message;
    next(err);
  }
});

module.exports = router;
