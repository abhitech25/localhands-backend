const express = require('express');
const cors = require('cors');
const path = require('path');

require('dotenv').config();

const pool = require('./config/database');

const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const addressRoutes = require('./routes/addressRoutes');
const authRoutes = require('./routes/authRoutes');
const workerRoutes = require('./routes/workerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');
const reviewRoutes = require('./routes/reviewRoutes');

const paymentRoutes = require("./routes/paymentRoutes");



const app = express();

app.use(cors());
app.use(express.json());


// Serve uploaded files
app.use(
  '/uploads',
  express.static(
    path.join(__dirname, 'uploads')
  )
);


// Routes
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use("/api/payments", paymentRoutes);



app.use('/api/reviews', reviewRoutes);

// Root
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'LocalHands API is running',
  });
});


// Health check
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');

    res.json({
      success: true,
      message: 'LocalHands backend is healthy',
      database: 'connected',
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: 'Database connection failed',
    });
  }
});


// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `LocalHands API running on port ${PORT}`
  );
});