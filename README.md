# Files World - Free Online File Management & Processing Service

Files World is a full-stack Node.js web app for anonymous, temporary, free file operations.

## What it supports

1. Upload/download files (any format except dangerous executable extensions)
2. Merge files (PDF merge or ZIP bundle)
3. Split files (PDF page ranges or text chunks)
4. Compress files (PDF, images, generic gzip)
5. Convert files (to/from PDF, office, text, images)
6. Edit files (annotation, text replace, OCR-editable output)
7. Manipulate files (rotate, crop, watermark, encrypt/decrypt, extract pages/text)

## Architecture

- **Frontend:** `public/index.html`, `public/style.css`, `public/app.js`
- **Backend:** Express + modular routes
  - `POST /api/files/upload`
  - `GET /api/files/download/:jobId/:filename`
  - `POST /api/merge`
  - `POST /api/split`
  - `POST /api/compress`
  - `POST /api/convert`
  - `POST /api/edit`
  - `POST /api/manipulate`

## AI-based OCR example

OCR is implemented with `tesseract.js` in `src/services/ocrService.js`:

- Extracts text from image/PDF-like scan input
- Writes recognized text to `.txt`
- Builds editable text PDF output

```js
const result = await Tesseract.recognize(inputPath, 'eng', { tessedit_pageseg_mode: Tesseract.PSM.AUTO });
```

## File conversion example

Conversion logic is in `src/services/conversionService.js`:

- Office <-> PDF via `libreoffice-convert`
- Image -> PDF via PDF composition
- Text/CSV/Markdown -> PDF
- PDF -> TXT/MD via `pdf-parse`

## Security and concurrency

- Temporary per-job folders under `tmp/` with UUID isolation
- Auto cleanup of expired temp files
- File size/count limits via Multer
- Blocked executable file extensions (`.exe`, `.bat`, etc.)
- Stateless endpoints safe for multiple simultaneous users

## Local installation

```bash
npm install
npm start
```

Development mode:

```bash
npm run dev
```

Open: `http://localhost:3000`

## Notes

- DOCX/XLSX/PPTX conversion requires LibreOffice available on the server.
- If LibreOffice is unavailable, DOCX conversion falls back to text extraction where possible.
