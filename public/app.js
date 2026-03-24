const operations = {
  upload: { label: 'Upload / Download', endpoint: '/api/files/upload', help: 'Store files temporarily and get download URLs.', options: [] },
  merge: { label: 'Merge Files', endpoint: '/api/merge', help: 'Merge PDFs into one; non-PDF files are bundled as ZIP.', options: [] },
  split: { label: 'Split Files', endpoint: '/api/split', help: 'Split PDF by page ranges or split text files by chunk size.', options: [
    { key: 'pageRanges', label: 'Page ranges (PDF)', placeholder: '1-2,3-5' },
    { key: 'chunkSize', label: 'Chunk size (text)', placeholder: '1000' },
  ] },
  compress: { label: 'Compress', endpoint: '/api/compress', help: 'Compress PDF/image/other files.', options: [] },
  convert: { label: 'Convert', endpoint: '/api/convert', help: 'Convert to PDF or from PDF to office/text formats.', options: [
    { key: 'targetFormat', label: 'Target format', type: 'select', values: ['pdf', 'txt', 'md', 'docx', 'xlsx', 'pptx'] },
  ] },
  edit: { label: 'Edit + OCR', endpoint: '/api/edit', help: 'Annotate PDF, run OCR, or text replace for text files.', options: [
    { key: 'mode', label: 'Edit mode', type: 'select', values: ['annotate', 'ocr', 'text-replace'] },
    { key: 'note', label: 'Annotation note', placeholder: 'Reviewed and approved' },
    { key: 'find', label: 'Find text (for text-replace)', placeholder: 'old phrase' },
    { key: 'replace', label: 'Replace with', placeholder: 'new phrase' },
    { key: 'lang', label: 'OCR language', placeholder: 'eng' },
  ] },
  manipulate: { label: 'Manipulate', endpoint: '/api/manipulate', help: 'Rotate, crop, watermark, encrypt/decrypt, extract pages/text.', options: [
    { key: 'operation', label: 'Operation', type: 'select', values: ['rotate', 'crop', 'watermark', 'encrypt', 'decrypt', 'extract-pages', 'extract-text'] },
    { key: 'angle', label: 'Rotate angle', placeholder: '90' },
    { key: 'factor', label: 'Crop factor (pdf)', placeholder: '0.9' },
    { key: 'text', label: 'Watermark text', placeholder: 'CONFIDENTIAL' },
    { key: 'pages', label: 'Extract pages', placeholder: '1,2,7' },
    { key: 'passphrase', label: 'Encrypt/Decrypt passphrase', placeholder: 'your-secret-passphrase' },
  ] },
};

let currentOperation = 'upload';
let selectedFiles = [];

const grid = document.getElementById('tool-grid');
const optionsEl = document.getElementById('options');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const fileList = document.getElementById('file-list');
const dropZone = document.getElementById('drop-zone');
const processBtn = document.getElementById('process-btn');
const statusArea = document.getElementById('status-area');
const statusMessage = document.getElementById('status-message');
const progressBar = document.getElementById('progress-bar');
const resultEl = document.getElementById('result');
const resultText = document.getElementById('result-text');
const downloadLink = document.getElementById('download-link');

function renderButtons() {
  grid.innerHTML = '';
  Object.entries(operations).forEach(([key, op]) => {
    const btn = document.createElement('button');
    btn.textContent = op.label;
    btn.classList.toggle('active', key === currentOperation);
    btn.addEventListener('click', () => {
      currentOperation = key;
      renderButtons();
      renderOptions();
      statusMessage.textContent = op.help;
    });
    grid.appendChild(btn);
  });
}

function renderOptions() {
  optionsEl.innerHTML = '';
  operations[currentOperation].options.forEach((opt) => {
    const label = document.createElement('label');
    label.textContent = opt.label;
    const input = opt.type === 'select' ? document.createElement('select') : document.createElement('input');
    if (opt.type === 'select') {
      opt.values.forEach((v) => {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v.toUpperCase();
        input.appendChild(o);
      });
    } else {
      input.type = 'text';
      input.placeholder = opt.placeholder || '';
    }
    input.id = `opt_${opt.key}`;
    label.appendChild(input);
    optionsEl.appendChild(label);
  });
}

function gatherOptions() {
  const body = {};
  operations[currentOperation].options.forEach((opt) => {
    const input = document.getElementById(`opt_${opt.key}`);
    if (input?.value) body[opt.key] = input.value;
  });
  return body;
}

function setFiles(files) {
  selectedFiles = [...files];
  fileList.textContent = selectedFiles.length ? selectedFiles.map((f) => f.name).join(', ') : 'No files selected.';
}

browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => setFiles(e.target.files));

['dragenter', 'dragover'].forEach((event) => dropZone.addEventListener(event, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); }));
['dragleave', 'drop'].forEach((event) => dropZone.addEventListener(event, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
dropZone.addEventListener('drop', (e) => setFiles(e.dataTransfer.files));

processBtn.addEventListener('click', () => {
  if (!selectedFiles.length) return alert('Please select at least one file.');

  const form = new FormData();
  selectedFiles.forEach((f) => form.append('files', f));
  Object.entries(gatherOptions()).forEach(([k, v]) => form.append(k, v));

  statusArea.hidden = false;
  resultEl.hidden = true;
  progressBar.style.width = '0%';

  const xhr = new XMLHttpRequest();
  xhr.open('POST', operations[currentOperation].endpoint);
  xhr.upload.onprogress = (e) => {
    if (!e.lengthComputable) return;
    const p = Math.round((e.loaded / e.total) * 100);
    progressBar.style.width = `${p}%`;
    statusMessage.textContent = `Uploading ${p}%...`;
  };

  xhr.onreadystatechange = () => {
    if (xhr.readyState !== 4) return;
    if (xhr.status >= 200 && xhr.status < 300) {
      const data = JSON.parse(xhr.responseText);
      progressBar.style.width = '100%';
      statusMessage.textContent = data.message || 'Completed.';
      resultEl.hidden = false;
      if (data.downloadUrl) {
        downloadLink.hidden = false;
        downloadLink.href = data.downloadUrl;
      } else if (data.files?.[0]?.downloadUrl) {
        downloadLink.hidden = false;
        downloadLink.href = data.files[0].downloadUrl;
      } else {
        downloadLink.hidden = true;
      }
      resultText.textContent = data.message || `Done. ${data.files?.length || ''}`;
    } else {
      let err = 'Request failed.';
      try { err = JSON.parse(xhr.responseText).error || err; } catch (_e) {}
      statusMessage.textContent = err;
    }
  };

  xhr.send(form);
});

renderButtons();
renderOptions();
statusArea.hidden = false;
statusMessage.textContent = operations[currentOperation].help;
