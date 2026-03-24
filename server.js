const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const { requestLogger } = require('./src/middleware/logger');
const { scheduleTempCleanup } = require('./src/services/fileManager');

const filesRoute = require('./src/routes/files');
const mergeRoute = require('./src/routes/merge');
const splitRoute = require('./src/routes/split');
const compressRoute = require('./src/routes/compress');
const convertRoute = require('./src/routes/convert');
const editRoute = require('./src/routes/edit');
const manipulateRoute = require('./src/routes/manipulate');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors());
app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/files', filesRoute);
app.use('/api/merge', mergeRoute);
app.use('/api/split', splitRoute);
app.use('/api/compress', compressRoute);
app.use('/api/convert', convertRoute);
app.use('/api/edit', editRoute);
app.use('/api/manipulate', manipulateRoute);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(err.statusCode || 500).json({
    error: err.publicMessage || 'File processing failed. Please try a different file or option.',
    details: process.env.NODE_ENV === 'production' ? undefined : err.message,
  });
});

app.listen(PORT, () => {
  scheduleTempCleanup();
  console.log(`Files World running on http://localhost:${PORT}`);
});
