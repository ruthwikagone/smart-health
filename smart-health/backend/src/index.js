require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const initSocket = require('./socket');
const { startAlertScheduler } = require('./services/alertScheduler');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*', methods: ['GET', 'POST'] },
});

initSocket(io);
app.set('io', io);
startAlertScheduler(io);

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

//app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(cors({
  origin: "https://smart-health-wokt.vercel.app",
  credentials: true
}));
app.use(express.json({ limit: '10kb' }));

// Rate limiter for login
const loginAttempts = new Map();
app.use('/api/auth/login', (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const recent = (loginAttempts.get(ip) || []).filter(t => now - t < 15 * 60 * 1000);
  if (recent.length >= 10) {
    return res.status(429).json({ success: false, message: 'Too many login attempts. Try again in 15 minutes.' });
  }
  recent.push(now);
  loginAttempts.set(ip, recent);
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/centers', require('./routes/centers'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/emergency', require('./routes/emergency'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/profile', require('./routes/profile'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the old backend process and restart.`);
    process.exit(1);
  }

  console.error('Server failed to start:', error.message);
  process.exit(1);
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = { app, server };
