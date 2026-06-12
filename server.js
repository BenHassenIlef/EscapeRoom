const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');
const nodemailer = require('nodemailer');

// ── Config (env vars override hardcoded defaults) ────────────────────────────
const EMAIL_USER = process.env.EMAIL_USER || 'your_email@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'your_app_password';
const EMAIL_FROM = process.env.EMAIL_FROM || '"The Room Escape Game" <your_email@gmail.com>';

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

const app = express();
const PORT = process.env.PORT || 8081;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_minimum_256_bits_long_for_security_purposes_change_this_in_production';
const JWT_EXPIRES = '24h';

// ── CORS ──────────────────────────────────────────────────────────────────────
// Set ALLOWED_ORIGINS env var to a comma-separated list of trusted origins.
// E.g. ALLOWED_ORIGINS=https://theroom.tn,https://www.theroom.tn
// If unset, only same-origin and localhost requests are allowed (dev mode).
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Same-origin requests served by Express itself have no Origin header
    if (!origin) return cb(null, true);
    // Explicit whitelist takes priority
    if (ALLOWED_ORIGINS.length && ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    // Dev fallback: allow any localhost port when no whitelist is configured
    if (!ALLOWED_ORIGINS.length && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed — set ALLOWED_ORIGINS env var'));
  },
  credentials: true
}));
app.use(express.json({ limit: '4mb' })); // allow larger payloads for scenario images
app.use(express.static(path.join(__dirname)));

// ── Database ──────────────────────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5433,
  database: process.env.DB_NAME     || 'escape_room',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASS     || 'postgres123'
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
  await pool.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`);

  // If scenarios table exists with the wrong schema (legacy Java app columns, no `data` JSONB),
  // drop it so we can recreate it with the correct structure.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scenarios')
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'scenarios' AND column_name = 'data'
      ) THEN
        DROP TABLE scenarios CASCADE;
      END IF;
    END $$
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scenarios (
      id VARCHAR(100) PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

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

// ── Auth Middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireSuperAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Super Admin access required' });
    }
    next();
  });
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

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );
    res.json({ token, role: admin.role, name: admin.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Admins CRUD (backend is the source of truth) ──────────────────────────────
app.get('/api/admins', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, role, name, photo FROM admins ORDER BY created_at'
    );
    // Never return password hashes
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admins/me/profile', requireAuth, async (req, res) => {
  const { name, photo } = req.body || {};
  const safeName = String(name || '').trim();
  if (!safeName) return res.status(400).json({ error: 'Name is required' });
  try {
    const { rows } = await pool.query(
      'UPDATE admins SET name=$1, photo=$2 WHERE id=$3 RETURNING id, email, role, name, photo',
      [safeName, photo || '', req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Admin not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admins', requireSuperAdmin, async (req, res) => {
  const { email, password, role, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const safeRole = ['ADMIN', 'SUPER_ADMIN'].includes(role) ? role : 'ADMIN';
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO admins (email, password, role, name) VALUES ($1,$2,$3,$4) RETURNING id, email, role, name',
      [email.toLowerCase().trim(), hash, safeRole, name || email]
    );
    await pool.query(
      `INSERT INTO notifications (type, action, message, admin_email, customer_name)
       VALUES ($1,$2,$3,$4,$5)`,
      ['admin', 'admin-added', req.user.email + ' a ajouté un nouvel admin: ' + (name || email) + ' (' + safeRole + ')',
       req.user.email, name || email]
    ).catch(() => {});
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Admin with this email already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admins/:id', requireSuperAdmin, async (req, res) => {
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  try {
    const adminRow = await pool.query('SELECT email, name FROM admins WHERE id=$1', [req.params.id]);
    const deleted = adminRow.rows[0] || {};
    const { rowCount } = await pool.query('DELETE FROM admins WHERE id=$1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Admin not found' });
    await pool.query(
      `INSERT INTO notifications (type, action, message, admin_email, customer_name)
       VALUES ($1,$2,$3,$4,$5)`,
      ['admin', 'admin-deleted', req.user.email + ' a supprimé l\'admin: ' + (deleted.email || req.params.id),
       req.user.email, deleted.name || deleted.email || '']
    ).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Scenarios CRUD ────────────────────────────────────────────────────────────
// Public GET — frontend and booking page can read scenarios from DB
app.get('/api/scenarios', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT data FROM scenarios ORDER BY data->>\'order\' NULLS LAST, id');
    res.json(rows.map(r => r.data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Bulk replace — admin saves the full array
app.put('/api/scenarios', requireSuperAdmin, async (req, res) => {
  const list = req.body;
  if (!Array.isArray(list)) return res.status(400).json({ error: 'Array expected' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM scenarios');
    for (const scenario of list) {
      if (!scenario || !scenario.id) continue;
      await client.query(
        'INSERT INTO scenarios (id, data, updated_at) VALUES ($1,$2,NOW())',
        [scenario.id, JSON.stringify(scenario)]
      );
    }
    await client.query('COMMIT');
    await pool.query(
      `INSERT INTO notifications (type, action, message, admin_email)
       VALUES ($1,$2,$3,$4)`,
      ['scenario', 'scenario-saved', req.user.email + ' a mis à jour les scénarios (' + list.length + ' scénarios)',
       req.user.email]
    ).catch(() => {});
    res.json({ success: true, count: list.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
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
app.get('/api/reservations', requireAuth, async (req, res) => {
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
    const slotTime = reservationDateTime || new Date().toISOString();
    const conflict = await pool.query(
      `SELECT id
       FROM reservations
       WHERE LOWER(COALESCE(scenario_name, '')) = LOWER($1)
         AND reservation_date_time = $2::timestamp
         AND status NOT IN ('CANCELLED')
       LIMIT 1`,
      [scenarioName || 'Unknown', slotTime]
    );
    if (conflict.rowCount > 0) {
      return res.status(409).json({ error: 'This time slot is already booked' });
    }

    const { rows } = await pool.query(
      `INSERT INTO reservations (customer_name, customer_email, customer_phone, scenario_name, number_of_players, reservation_date_time, notes, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING',NOW()) RETURNING *`,
      [
        customerName,
        customerEmail || '',
        customerPhone || '',
        scenarioName || 'Unknown',
        numberOfPlayers || 1,
        slotTime,
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
    // Notification: new reservation from a client
    await pool.query(
      `INSERT INTO notifications (type, action, message, admin_email, reservation_id, customer_name, scenario_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['new-reservation', 'new-reservation',
       'Nouvelle réservation: ' + customerName + ' — ' + (scenarioName || 'Unknown') + ' le ' + slotTime,
       'client', String(r.id), customerName, scenarioName || 'Unknown']
    ).catch(() => {});
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
    const resRow = await pool.query('SELECT customer_name, scenario_name FROM reservations WHERE id=$1', [id]);
    const r = resRow.rows[0] || {};
    const { rowCount } = await pool.query('UPDATE reservations SET status=$1, updated_at=NOW() WHERE id=$2', [status, id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Reservation not found' });
    broadcastSSE('reservation-updated', { id: Number(id), status });
    const verbs = { CONFIRMED: 'a confirmé', CANCELLED: 'a annulé', COMPLETED: 'a complété', PENDING: 'a remis en attente' };
    const verb = verbs[status] || ('a mis à jour le statut en ' + status + ' pour');
    await pool.query(
      `INSERT INTO notifications (type, action, message, admin_email, reservation_id, customer_name, scenario_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['status-change', status.toLowerCase(), req.user.email + ' ' + verb + ' la réservation de ' + (r.customer_name || id) + ' — ' + (r.scenario_name || ''),
       req.user.email, String(id), r.customer_name || '', r.scenario_name || '']
    ).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/reservations/:id', requireAuth, async (req, res) => {
  try {
    const resRow = await pool.query('SELECT customer_name, scenario_name FROM reservations WHERE id=$1', [req.params.id]);
    const r = resRow.rows[0] || {};
    await pool.query('DELETE FROM reservations WHERE id=$1', [req.params.id]);
    await pool.query(
      `INSERT INTO notifications (type, action, message, admin_email, reservation_id, customer_name, scenario_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['deleted', 'deleted', req.user.email + ' a supprimé la réservation de ' + (r.customer_name || req.params.id) + ' — ' + (r.scenario_name || ''),
       req.user.email, String(req.params.id), r.customer_name || '', r.scenario_name || '']
    ).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Public availability (no auth) ─────────────────────────────────────────────
app.get('/api/availability', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT scenario_name, reservation_date_time
       FROM reservations
       WHERE status NOT IN ('CANCELLED')
       ORDER BY reservation_date_time`
    );
    const slots = rows.map(r => {
      const dt = r.reservation_date_time;
      if (!dt) return null;
      const pad = n => String(n).padStart(2, '0');
      const dateStr = dt.toISOString().split('T')[0];
      const startH  = dt.getUTCHours();
      const startM  = dt.getUTCMinutes();
      const startTime = pad(startH) + ':' + pad(startM);
      const endTotalMins = (startH * 60 + startM + 90) % (24 * 60);
      const endTime = pad(Math.floor(endTotalMins / 60)) + ':' + pad(endTotalMins % 60);
      return { scenario: r.scenario_name, date: dateStr, time: startTime + ' - ' + endTime };
    }).filter(Boolean);
    res.json(slots);
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
    const authHint = /(?:EAUTH|Invalid login|Username and Password not accepted)/i.test(err.message)
      ? ' Gmail rejected the login. Use a Google App Password with 2-step verification enabled, not your normal account password.'
      : '';
    res.status(500).json({ error: 'Failed to send email: ' + err.message + authHint });
  }
});

// ── Notifications ─────────────────────────────────────────────────────────────
app.get('/api/notifications', requireSuperAdmin, async (req, res) => {
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

// Notifications are permanent — deletion is intentionally disabled.

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
