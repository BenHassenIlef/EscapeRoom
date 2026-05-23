const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5433, database: 'escape_room', user: 'postgres', password: 'postgres123' });

pool.query(`
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
`).then(() => {
  console.log('notifications table ready.');
  pool.end();
}).catch(err => {
  console.error(err.message);
  pool.end();
});
