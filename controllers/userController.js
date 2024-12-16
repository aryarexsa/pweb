const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Notification = require('../models/Notification');
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

exports.dashboard = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.redirect('/auth/login');
    }

    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(404).send('User not found');
    }

    res.render('dashboard', { user, notifications: user.notifications });
  } catch (err) {
    console.error('Error loading dashboard:', err);
    res.status(500).send('Error loading dashboard.');
  }
};

exports.searchUser = async (req, res) => {
  try {
    const { username } = req.query;

    const users = await User.find({ username: new RegExp(username, 'i') });
    res.json(users);
  } catch (err) {
    console.error('Error searching for users:', err);
    res.status(500).send('Error searching for users.');
  }
};

exports.sendPDF = async (req, res) => {
  try {
    const { targetUserId, positionX, positionY, pageNumber } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    if (!positionX || !positionY || !pageNumber) {
      return res.status(400).json({ error: 'Signature position is required' });
    }

    const targetUser = await User.findById(targetUserId);
    const senderUser = await User.findById(req.session.userId); // User pengirim

    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Notifikasi untuk pengirim
    await Notification.create({
      userId: senderUser._id,
      message: `Success! You sent a PDF to ${targetUser.username}.`,
      type: 'success',
    });

    // Notifikasi untuk penerima
    await Notification.create({
      userId: targetUser._id,
      message: `${senderUser.username} sent you a PDF document.`,
      type: 'info',
    });

    // Simpan informasi ke notifikasi di dalam user target
    targetUser.notifications.push({
      message: `You have received a PDF from ${senderUser.username}.`,
      pdfFilePath: req.file.path,
      signatureLocation: { x: positionX, y: positionY, page: pageNumber },
      isRead: false,
    });

    await targetUser.save();

    res.status(200).json({ success: true, message: 'PDF sent successfully!' });
  } catch (error) {
    console.error('Error sending PDF:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getNotifications = async (req, res) => {
  const user = await User.findById(req.session.userId);
  res.json(user.notifications);
};

exports.signPdf = async (req, res) => {
  try {
    const { pdfId, method } = req.body;
    const user = await User.findById(req.session.userId);
    const pdf = user.pdfs.id(pdfId);

    if (!pdf) return res.status(404).json({ message: 'PDF tidak ditemukan.' });

    if (method === 'manual') {
      pdf.isSigned = true;
      pdf.signedBy = req.session.userId;
    } else if (req.file) {
      pdf.signatureFile = req.file.filename;
      pdf.isSigned = true;
      pdf.signedBy = req.session.userId;
    }

    await user.save();
    res.json({ message: 'PDF berhasil ditandatangani.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};