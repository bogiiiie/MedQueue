require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// ── Middleware ──
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.post('/test', (req, res) => res.json({ ok: true, body: req.body }));

app.get('/debug-staff', async (req, res) => {
  const sheets = require('./sheets');
  const staff = await sheets.getStaffByUsername('ana123');
  res.json(staff);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'medqueue_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8,  // 8 hours
    httpOnly: true,
    sameSite: 'lax',
    secure: false
  }
}));

// ── Attach Socket.io to requests so routes can emit events ──
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ── Routes first — before static files ──
const queueRoutes = require('./routes/queue');
const authRoutes = require('./routes/auth');

app.use('/api/queue', queueRoutes);
app.use('/api/auth', authRoutes);

// ── Serve static files after routes ──
app.use(express.static(path.join(__dirname)));

// ── Page routes ──
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/live-display', (req, res) => res.sendFile(path.join(__dirname, 'live-display.html')));
app.get('/queue-status', (req, res) => res.sendFile(path.join(__dirname, 'queue-status.html')));
app.get('/staff-login', (req, res) => res.sendFile(path.join(__dirname, 'staff-login.html')));
app.get('/counter-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'counter-dashboard.html')));

// ── Socket.io events ──
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // ── Almost your turn — emitted by patient's status page every 5s ──
  // Forwards the notification to all counter clients so they can send the email via EmailJS
  socket.on('notify:almost', (data) => {
    if (!data.email || !data.queue_number) {
      console.warn('notify:almost received with missing data:', data);
      return;
    }

    console.log(`[SERVER] notify:almost received for ${data.queue_number} → broadcasting send:email:almost`); // ← add this

    io.emit('send:email:almost', {
      email: data.email,
      patient_name: data.patient_name,
      queue_number: data.queue_number,
      department: data.department,
      counter: data.counter,
      patients_ahead: data.patients_ahead,
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ── Start server ──
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`MedQueue server running at http://localhost:${PORT}`);
});