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
    console.log(`Received Page Number: ${pageNumber}`); // Debugging untuk memastikan nilai

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

    if (!req.body.targetUserId || !req.body.positionX || !req.body.positionY || !req.body.pageNumber) {
      return res.status(400).json({ error: 'Incomplete data' });
    }

    await Notification.create({
      userId: senderUser._id,
      message: `You successfully sent a PDF to ${targetUser.username}.`,
      senderUser: senderUser._id,
      targetUser: targetUser._id,
      actionType: null, // Tidak ada aksi untuk sender
    });

    // Notifikasi untuk penerima
    await Notification.create({
      userId: targetUser._id,
      message: `${senderUser.username} sent you a PDF document.`,
      senderUser: senderUser._id, // Tambahkan pengirim
      targetUser: targetUser._id, // Penerima
      actionType: 'sign',
      actionLink: `/user/sign-pdf/${req.file.filename}`,
    });

    // Simpan informasi ke notifikasi di dalam user target
    targetUser.notifications.push({
      message: `You have received a PDF from ${senderUser.username}.`,
      pdfFilePath: req.file.path,
      signatureLocation: { x: positionX, y: positionY, page: pageNumber },
      isRead: false,
      actionLink: `/user/sign-pdf/${req.file.filename}`, // Link ke page penambahan tanda tangan
      actionType: 'sign', // Properti 'type' untuk membedakan jenis notifikasi
      senderUser: senderUser._id, 
    });
    await targetUser.save();

    // Notifikasi untuk user sender
    senderUser.notifications.push({
      message: `You successfully sent a PDF to ${targetUser.username}.`,
      pdfFilePath: req.file.path,
      signatureLocation: { x: positionX, y: positionY, page: pageNumber },
      isRead: false,
    });
    await senderUser.save();

    // res.redirect('/user/dashboard');
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

exports.signPage = async (req, res) => {
  try {
    const { filename } = req.params;
    const targetUser = await User.findById(req.session.userId);
    const notification = targetUser.notifications.find(
      (n) => n.pdfFilePath && n.pdfFilePath.includes(filename)
    );

    if (!notification) {
      console.log('Notification not found for this file.');
      return res.status(404).send('Notification not found');
    }

    console.log('Notification:', notification); // Debugging isi notifikasi

    const senderUser = await User.findById(notification.senderUser); // Cari pengirim berdasarkan ID
    if (!senderUser) {
      console.log('Sender user not found for ID:', notification.senderUser);
      return res.status(404).send('Sender user not found');
    }

    const pageNumber = notification.signatureLocation?.page || 1;
    console.log(`Sending pageNumber to view: ${pageNumber}`);

    res.render('sign-pdf', {
      filename,
      notification: {
        ...notification.toObject(),
        senderId: notification.senderUser, // Masukkan senderUser sebagai ID
      },
      pageNumber,
    });
  } catch (error) {
    console.error('Error loading sign page:', error);
    res.status(500).send('Internal server error');
  }
};




exports.submitSignature = async (req, res) => {
  try {
    const { filename } = req.params;
    const senderId = req.body.senderId; // User pengirim awal (senderUser)

    console.log('Filename:', filename);
    console.log('Sender ID:', senderId);

    // Cari targetUser (user yang sedang menandatangani)
    const targetUser = await User.findById(req.session.userId);
    if (!targetUser) {
      console.log('Target user not found');
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Cari senderUser (user yang mengirim file)
    const senderUser = await User.findById(senderId);
    if (!senderUser) {
      console.log('Sender user not found');
      return res.status(404).json({ error: 'Sender user not found' });
    }

    // Validasi tanda tangan (file atau dataURL)
    if (!req.file && !req.body.signatureDataUrl) {
      console.log('No signature provided');
      return res.status(400).json({ error: 'No signature provided' });
    }

    let signedFilePath;

    // Jika tanda tangan berasal dari canvas (signatureDataUrl)
    if (req.body.signatureDataUrl) {
      const buffer = Buffer.from(req.body.signatureDataUrl.split(',')[1], 'base64');
      signedFilePath = `uploads/signatures/${Date.now()}-signed.png`;
      fs.writeFileSync(signedFilePath, buffer); // Simpan file tanda tangan
      console.log('Canvas signature saved to:', signedFilePath);
    }

    // Jika tanda tangan diunggah sebagai file
    if (req.file) {
      signedFilePath = req.file.path;
      console.log('Uploaded signature saved to:', signedFilePath);
    }

    // Tambahkan notifikasi untuk targetUser (user yang menandatangani)
    targetUser.notifications.push({
      message: `You have signed the file "${filename}".`,
      pdfFilePath: signedFilePath,
      isRead: false,
      actionType: 'download', // Bisa download file tanda tangan
      actionLink: `/download/${filename}`, // Link untuk download file
    });

    // Tambahkan notifikasi untuk senderUser (user pengirim awal)
    senderUser.notifications.push({
      message: `${targetUser.username} has signed your file "${filename}".`,
      pdfFilePath: signedFilePath,
      isRead: false,
      actionType: 'download', // Bisa download file tanda tangan
      actionLink: `/download/${filename}`, // Link untuk download file
    });

    // Simpan perubahan ke database
    await targetUser.save(); // Simpan perubahan untuk targetUser
    await senderUser.save(); // Simpan perubahan untuk senderUser

    console.log('Notifications added for both senderUser and targetUser');
    console.log('Signed file path:', signedFilePath);

    // Tanggapan sukses
    res.status(200).json({
      success: true,
      message: 'Signature added and notifications sent successfully.',
    });
  } catch (error) {
    console.error('Error saving signature:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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

exports.uploadSignature = async (req, res) => {
  try {
    // Validasi file yang diunggah
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded or invalid file type' });
    }

    // Log informasi file yang diterima
    console.log('Uploaded File:', req.file);

    // Simpan informasi file ke database atau lakukan proses lainnya
    res.status(200).json({ success: true, message: 'Signature uploaded successfully', filePath: req.file.path });
  } catch (error) {
    console.error('Error uploading signature:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
