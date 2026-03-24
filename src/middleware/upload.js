const fs = require('fs/promises');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { TMP_DIR } = require('../services/fileManager');

const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE_BYTES || 1024 * 1024 * 100); // 100MB
const MAX_FILES = Number(process.env.MAX_FILES || 30);

const BLOCKED_EXTENSIONS = new Set(['.exe', '.bat', '.cmd', '.sh', '.msi', '.dll']);

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const inboxDir = path.join(TMP_DIR, 'inbox');
    await fs.mkdir(inboxDir, { recursive: true });
    cb(null, inboxDir);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}_${uuidv4()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return cb(new Error(`Blocked file type: ${ext}`));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
  fileFilter,
});

module.exports = {
  upload,
  MAX_FILE_SIZE,
  MAX_FILES,
};
