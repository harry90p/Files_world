const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const TMP_DIR = path.join(process.cwd(), 'tmp');
const FILE_TTL_MS = Number(process.env.FILE_TTL_MS || 1000 * 60 * 30);
const CLEANUP_INTERVAL_MS = Number(process.env.CLEANUP_INTERVAL_MS || 1000 * 60 * 10);

async function ensureTmpDir() {
  await fs.mkdir(TMP_DIR, { recursive: true });
}

async function createJobDir() {
  await ensureTmpDir();
  const jobId = uuidv4();
  const dir = path.join(TMP_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  return { jobId, dir };
}

function sanitizeName(name = 'file.bin') {
  return name.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

async function moveUploadsToJob(files, jobDir) {
  const moved = [];
  for (const file of files || []) {
    const target = path.join(jobDir, `${Date.now()}_${sanitizeName(file.originalname)}`);
    await fs.rename(file.path, target);
    moved.push({ ...file, movedPath: target, originalSafeName: sanitizeName(file.originalname) });
  }
  return moved;
}

async function removePath(targetPath) {
  if (!targetPath) return;
  await fs.rm(targetPath, { recursive: true, force: true });
}

async function cleanupExpiredFiles() {
  await ensureTmpDir();
  const now = Date.now();
  const entries = await fs.readdir(TMP_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(TMP_DIR, entry.name);
    const stats = await fs.stat(fullPath);
    if (now - stats.mtimeMs > FILE_TTL_MS) {
      await removePath(fullPath);
    }
  }
}

function scheduleTempCleanup() {
  cleanupExpiredFiles().catch((err) => console.warn('Initial cleanup failed:', err.message));
  setInterval(() => {
    cleanupExpiredFiles().catch((err) => console.warn('Scheduled cleanup failed:', err.message));
  }, CLEANUP_INTERVAL_MS).unref();
}

module.exports = {
  TMP_DIR,
  createJobDir,
  moveUploadsToJob,
  sanitizeName,
  removePath,
  cleanupExpiredFiles,
  scheduleTempCleanup,
};
