const path = require('path');

function parseCsvList(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function buildDownloadUrl(jobDir, outputPath) {
  return `/api/files/download/${path.basename(jobDir)}/${path.basename(outputPath)}`;
}

module.exports = {
  parseCsvList,
  buildDownloadUrl,
};
