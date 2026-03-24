const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const mime = require('mime-types');
const { upload } = require('../middleware/upload');
const { TMP_DIR, createJobDir, moveUploadsToJob } = require('../services/fileManager');
const { buildDownloadUrl } = require('../utils/routeHelpers');

const router = express.Router();

router.post('/upload', upload.array('files', 30), async (req, res, next) => {
  try {
    const { dir, jobId } = await createJobDir();
    const moved = await moveUploadsToJob(req.files || [], dir);
    req.logAction?.('upload', { count: moved.length });

    res.json({
      ok: true,
      jobId,
      files: moved.map((f) => ({
        originalName: f.originalname,
        storedName: path.basename(f.movedPath),
        downloadUrl: buildDownloadUrl(dir, f.movedPath),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/download/:jobId/:filename', async (req, res, next) => {
  try {
    const jobId = String(req.params.jobId).replace(/[^a-zA-Z0-9-]/g, '');
    const filename = path.basename(req.params.filename);
    const target = path.join(TMP_DIR, jobId, filename);
    await fs.access(target);
    req.logAction?.('download', { filename });
    res.setHeader('Content-Type', mime.lookup(target) || 'application/octet-stream');
    res.download(target, filename);
  } catch (err) {
    err.statusCode = 404;
    err.publicMessage = 'File not found or expired.';
    next(err);
  }
});

module.exports = router;
