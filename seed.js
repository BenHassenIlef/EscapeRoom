const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5433, database: 'escape_room', user: 'postgres', password: 'postgres123' });

(async () => {
  const h1 = await bcrypt.hash('superadmin', 10);
  const h2 = await bcrypt.hash('admin', 10);
  await pool.query('DELETE FROM admins');
  await pool.query(
    'INSERT INTO admins (email, password, role, name) VALUES ($1,$2,$3,$4), ($5,$6,$7,$8)',
    ['superadmin@gmail.com', h1, 'SUPER_ADMIN', 'Super Admin', 'admin@gmail.com', h2, 'ADMIN', 'Admin']
  );
  console.log('Admins seeded successfully.');
  await pool.end();
})();
