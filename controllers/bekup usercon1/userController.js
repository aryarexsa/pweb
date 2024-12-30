const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdf-lib').PDFDocument;
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
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const notifications = user.notifications.filter((notif) => notif.actionType !== null);
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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
    const pageNumber = parseInt(req.body.pageNumber, 10); // Ambil nomor halaman dari form

    console.log('Received Page Number:', pageNumber); // Debugging halaman

    console.log('Filename:', filename);
    console.log('Sender ID:', senderId);

    const targetUser = await User.findById(req.session.userId);
    const senderUser = await User.findById(senderId);
    
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    if (!senderUser) {
      return res.status(404).json({ error: 'Sender user not found' });
    }

    if (!req.file && !req.body.signatureDataUrl) {
      return res.status(400).json({ error: 'No signature provided' });
    }

    // Tambahkan tanda tangan ke halaman yang sesuai
    const targetPage = pages[pageNumber - 1]; // Halaman menggunakan indeks 0
    if (!targetPage) {
      return res.status(400).json({ error: 'Page number out of range' });
    }

    const pdfFilePath = `uploads/${filename}`;
    const pdfBytes = fs.readFileSync(pdfFilePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const pages = pdfDoc.getPages();
    if (pageNumber < 1 || pageNumber > pages.length) {
      return res.status(400).json({ error: 'Invalid page number provided' });
    }
    const signatureLocation = req.body.signatureLocation
      ? JSON.parse(req.body.signatureLocation)
      : { x: 0.5, y: 0.5, page: 1 }; // Default koordinat jika tidak ada

    const pageIndex = signatureLocation.page - 1; // PDF dimulai dari index 0
    const page = pages[pageIndex];

    let signatureImageBytes;

    if (req.body.signatureDataUrl) {
      signatureImageBytes = Buffer.from(req.body.signatureDataUrl.split(',')[1], 'base64');
    } else if (req.file) {
      signatureImageBytes = fs.readFileSync(req.file.path);
    }

    const pngImageBytes = fs.readFileSync(signatureImagePath);
    const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
    const signDims = signatureImage.scale(0.25); // Skala tanda tangan
    const pngDims = pngImage.scale(0.25); // Skala tanda tangan

    // Tambahkan tanda tangan ke halaman
    page.drawImage(signatureImage, {
      x: signatureLocation.x * page.getWidth(),
      y: signatureLocation.y * page.getHeight(),
      width: signDims.width,
      height: signDims.height,
    });

    // Sesuaikan koordinat berdasarkan posisi halaman
    targetPage.drawImage(pngImage, {
      x: 100, // Koordinat X placeholder (nanti kita sesuaikan)
      y: 100, // Koordinat Y placeholder (nanti kita sesuaikan)
      width: pngDims.width,
      height: pngDims.height,
    });

    const signedDir = path.join(__dirname, '../uploads/signed');

    // Pastikan folder `signed` ada
    if (!fs.existsSync(signedDir)) {
      fs.mkdirSync(signedDir, { recursive: true });
    }

    // Simpan PDF yang ditandatangani
    const signedFilePath = path.join(signedDir, `signed-${filename}`);
    const signedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(signedFilePath, signedPdfBytes);

    console.log(`Signed PDF saved at ${signedFilePath}`);

    // Tambahkan notifikasi untuk pengirim
    senderUser.notifications.push({
      message: `${targetUser.username} has signed your file "${filename}".`,
      pdfFilePath: `uploads/signed/signed-${filename}`, // Update path sesuai lokasi baru
      isRead: false,
      actionType: 'download',
      actionLink: `/uploads/signed/signed-${filename}`, // Link untuk di-download
    });

    // **Perbarui Notifikasi Target**
    // Hapus `actionType` dari notifikasi lama
    targetUser.notifications.forEach((notif) => {
      if (notif.pdfFilePath && notif.pdfFilePath.includes(filename)) {
        notif.actionType = null;
      }
    });

    // Tambahkan notifikasi untuk targetUser
    targetUser.notifications.push({
      message: `You have signed the file "${filename}".`,
      pdfFilePath: signedFilePath,
      isRead: false,
      actionType: null,
    });

    await senderUser.save();
    await targetUser.save();

    res.status(200).json({
      success: true,
      message: 'Signature added and notifications sent successfully.',
    });
  } catch (error) {
    console.error('Error saving signature:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.downloadFile = (req, res) => {
  const { signedFilePath } = req.query; // Ambil signedFilePath dari query

  if (!signedFilePath) {
    return res.status(400).send('File path is required');
  }

  // Path absolut ke file
  const filePath = path.resolve(__dirname, '..', signedFilePath); // Sesuaikan dengan lokasi file di server Anda

  // Periksa apakah file ada
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('File not found:', filePath);
      return res.status(404).send('File not found');
    }

    // Kirim file untuk diunduh
    res.download(filePath, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        return res.status(500).send('Error downloading file');
      }
    });
  });
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
