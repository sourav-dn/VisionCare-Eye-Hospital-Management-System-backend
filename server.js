require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const morgan     = require('morgan');
const helmet     = require('helmet');
const path       = require('path');

const connectDB      = require('./config/db');
const initSocket     = require('./sockets/socket');
const errorHandler   = require('./middleware/errorHandler.middleware');

// ─── Route Imports ────────────────────────────────────────────────────────────
const authRoutes      = require('./routes/auth.routes');
const adminRoutes     = require('./routes/admin.routes');
const patientRoutes   = require('./routes/patient.routes');
const visitRoutes     = require('./routes/visit.routes');
const analyticsRoutes = require('./routes/analytics.routes');

// ─── App Setup ────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: {
    origin:      process.env.CLIENT_URL || 'http://localhost:5173',
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  },
});

// Make io accessible in controllers via req.app.get('io')
app.set('io', io);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static uploads (logo fallback if Cloudinary not configured)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/patients',  patientRoutes);
app.use('/api/visits',    visitRoutes);
app.use('/api/analytics', analyticsRoutes);

// Public doctor list (for department selection on booking page — no auth needed)
app.get('/api/departments', async (req, res, next) => {
  try {
    const Department = require('./models/Department.model');
    const depts = await Department.find({ isActive: true }).sort({ name: 1 });
    res.json({ success: true, data: depts });
  } catch (e) { next(e); }
});

// Public doctor listing per department (for patient booking)
app.get('/api/departments/:id/doctors', async (req, res, next) => {
  try {
    const User = require('./models/User.model');
    const doctors = await User.find({
      role:        'doctor',
      department:  req.params.id,
      isAvailable: true,
      isActive:    true,
    }).select('name').sort({ name: 1 });
    res.json({ success: true, data: doctors });
  } catch (e) { next(e); }
});

// Public all doctors listing with department & availability for Homepage
app.get('/api/public/doctors', async (req, res, next) => {
  try {
    const User = require('./models/User.model');
    const Room = require('./models/Room.model');
    const doctors = await User.find({ role: 'doctor', isActive: true })
      .populate('department', 'name description')
      .select('name email department isAvailable')
      .sort({ name: 1 });

    const doctorsWithRoom = await Promise.all(
      doctors.map(async (doc) => {
        const room = await Room.findOne({ assignedDoctor: doc._id }).select('roomNumber status');
        return {
          ...doc.toObject(),
          currentRoom: room ? room.roomNumber : null,
        };
      })
    );
    res.json({ success: true, data: doctorsWithRoom });
  } catch (e) { next(e); }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'VisionCare Eye Hospital API is running',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Socket Initialization ────────────────────────────────────────────────────
initSocket(io);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🏥  VisionCare Eye Hospital API`);
    console.log(`🚀  Server running on http://localhost:${PORT}`);
    console.log(`🌍  Environment: ${process.env.NODE_ENV}`);
    console.log(`📡  Socket.io ready\n`);
  });
});

module.exports = { app, server };
