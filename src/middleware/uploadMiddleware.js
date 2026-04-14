const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// Carpeta temporal para archivos subidos
const UPLOAD_DIR = path.join(__dirname, '../../uploads/tmp');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 16 * 1024 * 1024 }, // 16 MB máximo
});

// Middleware para el endpoint /send:
// Acepta campos: groupId, text + archivos opcionales: image, document
const uploadSend = upload.fields([
  { name: 'image',    maxCount: 1 },
  { name: 'document', maxCount: 1 },
]);

module.exports = { uploadSend, UPLOAD_DIR };
