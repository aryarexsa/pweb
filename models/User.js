const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  notifications: [
    {
      message: { type: String, required: true },
      pdfFilePath: { type: String },
      signatureLocation: { x: Number, y: Number, page: Number },
      isRead: { type: Boolean, default: false },
      actionLink: { type: String },
      actionType: { type: String, enum: ['sign', 'download'], default: null },
      senderUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // User pengirim
      targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // User penerima
      createdAt: { type: Date, default: Date.now },
    },
  ],
  
  
  pdfs: [
    {
      filename: String,
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // ID pengirim PDF
      signatureLocation: { x: Number, y: Number, page: Number },
      isSigned: { type: Boolean, default: false },
      signedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    },
  ],

  givenSigns: [
    {
      pdfId: mongoose.Schema.Types.ObjectId,
      signedAt: { type: Date, default: Date.now },
    },
  ],
});

module.exports = mongoose.model('User', userSchema);
