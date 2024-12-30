const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const multer = require('multer');
const path = require('path');

// Konfigurasi multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF or PNG files are allowed'), false);
    }
  },
});

router.get('/dashboard', userController.dashboard);


router.get('/search', userController.searchUser);
router.post('/send-pdf', upload.single('pdfFile'), userController.sendPDF); 
router.get('/sign-pdf/:filename', userController.signPage); // Page untuk tanda tangan
router.post('/sign-pdf/:filename', upload.single('signatureFile'), userController.submitSignature); // Form submit tanda tangan
router.get('/downloads', userController.downloadFile);
router.get('/uploads/signed/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../uploads/signed', req.params.filename);

  // Periksa apakah file ada
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  res.download(filePath, (err) => {
    if (err) {
      console.error('Error downloading file:', err);
      res.status(500).send('Error downloading file');
    }
  });
});

router.get('/notifications', userController.getNotifications);


module.exports = router;
