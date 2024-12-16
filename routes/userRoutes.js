const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const User = require('../models/User');
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
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

router.get('/dashboard', userController.dashboard);
router.get('/search', userController.searchUser);
router.post('/send-pdf', upload.single('pdfFile'), userController.sendPDF); // Gunakan upload di sini
router.get('/notifications', userController.getNotifications);
router.post('/sign-pdf', upload.single('signatureFile'), userController.signPdf);

module.exports = router;
