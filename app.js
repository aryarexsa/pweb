const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');

require('dotenv').config();

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Akses folder public
app.use('/uploads', express.static('uploads')); 
app.use(session({
  secret: process.env.SECRET_KEY || 'defaultSecretKey',
  resave: false,
  saveUninitialized: false
}));
app.use(express.json());

app.set('view engine', 'ejs');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error(err));

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
app.use('/auth', authRoutes);
app.use('/user', userRoutes);

app.get('/', (req, res) => {
  res.render('index');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
