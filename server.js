const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');
const nodemailer = require('nodemailer');

// ── Email config — fill in your Gmail credentials ────────────────────────────
const EMAIL_USER = 'your_email@gmail.com';      // your Gmail address
const EMAIL_PASS = 'your_app_password';          // Gmail App Password (not regular password)
const EMAIL_FROM = '"The Room Escape Game" <your_email@gmail.com>';

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

const app = express();
const PORT = 8081;
const JWT_SECRET = 'your_jwt_secret_key_minimum_256_bits_long_for_security_purposes_change_this_in_production';
const JWT_EXPIRES = '24h';

// ── Database ──────────────────────────────────────────────────────────────────
const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'escape_room',
  user: 'postgres',
  password: 'postgres123'
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'ADMIN',
      name VARCHAR(255),
      photo TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      type VARCHAR(100) NOT NULL DEFAULT 'action',
      action VARCHAR(100),
      message TEXT NOT NULL,
      admin_email VARCHAR(255),
      reservation_id VARCHAR(255),
      customer_name VARCHAR(255),
      scenario_name VARCHAR(255),
      read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id SERIAL PRIMARY KEY,
      customer_name VARCHAR(255) NOT NULL,
      customer_email VARCHAR(255),
      customer_phone VARCHAR(100),
      scenario_name VARCHAR(255),
      number_of_players INT DEFAULT 1,
      reservation_date_time TIMESTAMPTZ,
      notes TEXT,
      status VARCHAR(50) DEFAULT 'PENDING',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ
    )
  `);
  // Add updated_at to existing tables that were created before this column existed
  await pool.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`);

  // Seed default admins if none exist
  const { rowCount } = await pool.query('SELECT 1 FROM admins LIMIT 1');
  if (rowCount === 0) {
    const hash1 = await bcrypt.hash('superadmin', 10);
    const hash2 = await bcrypt.hash('admin', 10);
    await pool.query(
      'INSERT INTO admins (email, password, role, name) VALUES ($1,$2,$3,$4), ($5,$6,$7,$8)',
      [
        'superadmin@gmail.com', hash1, 'SUPER_ADMIN', 'Super Admin',
        'admin@gmail.com', hash2, 'ADMIN', 'Admin'
      ]
    );
    console.log('Seeded default admins.');
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  try {
    const { rows } = await pool.query('SELECT * FROM admins WHERE LOWER(email)=LOWER($1)', [email]);
    const admin = rows[0];
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({ token, role: admin.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── SSE (real-time push to admin dashboards) ──────────────────────────────────
const sseClients = [];

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write('data: connected\n\n');

  const client = { res };
  sseClients.push(client);
  req.on('close', () => {
    const i = sseClients.indexOf(client);
    if (i >= 0) sseClients.splice(i, 1);
  });
});

function broadcastSSE(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(c => { try { c.res.write(msg); } catch (_) {} });
}

// ── Reservations ──────────────────────────────────────────────────────────────
app.get('/api/reservations', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM reservations ORDER BY created_at DESC');
    res.json(rows.map(r => ({
      id: r.id,
      customerName: r.customer_name,
      customerEmail: r.customer_email,
      customerPhone: r.customer_phone,
      scenarioName: r.scenario_name,
      numberOfPlayers: r.number_of_players,
      reservationDateTime: r.reservation_date_time,
      notes: r.notes,
      status: r.status,
      createdAt: r.created_at
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/reservations', async (req, res) => {
  const { scenarioName, customerName, customerEmail, customerPhone, numberOfPlayers, reservationDateTime, notes } = req.body || {};
  if (!customerName) return res.status(400).json({ error: 'Customer name is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO reservations (customer_name, customer_email, customer_phone, scenario_name, number_of_players, reservation_date_time, notes, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING',NOW()) RETURNING *`,
      [
        customerName,
        customerEmail || '',
        customerPhone || '',
        scenarioName || 'Unknown',
        numberOfPlayers || 1,
        reservationDateTime || new Date().toISOString(),
        notes || ''
      ]
    );
    const r = rows[0];
    const payload = {
      id: r.id,
      customerName: r.customer_name,
      customerEmail: r.customer_email,
      scenarioName: r.scenario_name,
      status: r.status,
      createdAt: r.created_at
    };
    broadcastSSE('new-reservation', payload);
    res.status(201).json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/reservations/:id/status', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const allowed = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    const { rowCount } = await pool.query('UPDATE reservations SET status=$1, updated_at=NOW() WHERE id=$2', [status, id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Reservation not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/reservations/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM reservations WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Email ─────────────────────────────────────────────────────────────────────
app.post('/api/send-email', requireAuth, async (req, res) => {
  const { to, subject, body } = req.body || {};
  if (!to || !subject || !body) return res.status(400).json({ error: 'to, subject and body are required' });
  try {
    await mailer.sendMail({ from: EMAIL_FROM, to, subject, text: body });
    res.json({ success: true });
  } catch (err) {
    console.error('Email error:', err.message);
    res.status(500).json({ error: 'Failed to send email: ' + err.message });
  }
});

// ── Notifications ─────────────────────────────────────────────────────────────
app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC');
    res.json(rows.map(n => ({
      id: n.id,
      type: n.type,
      action: n.action,
      message: n.message,
      adminEmail: n.admin_email,
      reservationId: n.reservation_id,
      customerName: n.customer_name,
      scenarioName: n.scenario_name,
      read: n.read,
      createdAt: n.created_at
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/notifications', requireAuth, async (req, res) => {
  const { type, action, message, reservationId, customerName, scenarioName } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Message is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO notifications (type, action, message, admin_email, reservation_id, customer_name, scenario_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [type || 'action', action || null, message, req.user.email, reservationId || null, customerName || null, scenarioName || null]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET read=true WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/notifications/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM notifications WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function startWithRetry(retries = 10, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await initDB();
      app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
      return;
    } catch (err) {
      console.log(`Database not ready yet (attempt ${i}/${retries}): ${err.message}`);
      if (i === retries) {
        console.error('Could not connect to database after multiple attempts. Is PostgreSQL running?');
        process.exit(1);
      }
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

startWithRetry();
