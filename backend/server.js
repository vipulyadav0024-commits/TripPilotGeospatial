const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to MongoDB Database
connectDB();

const app = express();

// Middleware
// Comma-separated list of allowed frontend origins, e.g. "https://myapp.vercel.app,http://localhost:5173"
const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://trip-pilot-sigma.vercel.app', // default deployed frontend
    ...configuredOrigins
  ],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/trips', require('./routes/tripRoutes'));

// Basic health check route
app.get('/health', (req, res) => {
  res.json({ status: 'up', message: 'TripPilot API is running' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
