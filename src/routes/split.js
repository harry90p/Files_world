const express = require('express');
const path = require('path');
const { upload } = require('../middleware/upload');
const { createJobDir, moveUploadsToJob } = require('../services/fileManager');
const { splitPdf, splitText, mergeFilesAsZip } = require('../services/pdfService');
const { parseCsvList, buildDownloadUrl } = require('../utils/routeHelpers');

const router = express.Router();

router.post('/', upload.array('files', 1), async (req, res, next) => {
  try {
    const { dir } = await createJobDir();
    const [file] = await moveUploadsToJob(req.files || [], dir);
    if (!file) throw new Error('Upload one file to split.');

    const ext = path.extname(file.movedPath).toLowerCase();
    const outputs = ext === '.pdf'
      ? await splitPdf(file.movedPath, dir, parseCsvList(req.body.pageRanges))
      : await splitText(file.movedPath, dir, Number(req.body.chunkSize || 1000));

    if (!outputs.length) throw new Error('No segments were created. Check ranges/options.');
    const zipPath = path.join(dir, 'split_output.zip');
    await mergeFilesAsZip(outputs, zipPath);

    req.logAction?.('split', { ext, parts: outputs.length });
    res.json({ ok: true, message: 'Split completed.', downloadUrl: buildDownloadUrl(dir, zipPath) });
  } catch (err) {
    err.publicMessage = err.publicMessage || err.message;
    next(err);
  }
});

module.exports = router;
