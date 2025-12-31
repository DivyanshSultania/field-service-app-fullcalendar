const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'data.sqlite');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = new sqlite3.Database(DB_PATH);

// initialize tables if not present
const initSql = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  color TEXT,
  password_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  status TEXT,
  supervisor_id TEXT,
  FOREIGN KEY (supervisor_id) REFERENCES staff(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT,
  staff_id TEXT,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT,
  task_id TEXT,
  staff_id TEXT,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  client_name TEXT,
  company TEXT,
  email TEXT,
  phone TEXT,
  abn TEXT,
  acn TEXT,
  client_instruction TEXT,
  client_information TEXT,
  property_information TEXT
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  title TEXT,
  address TEXT,
  lat REAL,
  lng REAL,
  unit_no TEXT,
  radius_meters INTEGER,
  comment TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  task_name TEXT,
  assignment_type TEXT,
  staff_id TEXT,
  team_id TEXT,
  client_id TEXT,
  location_id TEXT,
  start_time TEXT,
  end_time TEXT,
  publish INTEGER DEFAULT 0,
  shift_instructions TEXT,
  color TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT, -- It will hold date time value but stored as text in DB
  stopped_at TEXT, -- It will hold date time value but stored as text in DB
  travel_from TEXT,
  travel_dist FLOAT,
  travel_duration FLOAT,
  payment_type TEXT,
  payment_amount TEXT,
  payment_date TEXT, -- It will hold date time value but stored as text in DB

  -- Task client
  task_client_name TEXT,
  task_client_company TEXT,
  task_client_email TEXT,
  task_client_phone TEXT,
  task_client_abn TEXT,
  task_client_acn TEXT,
  task_client_instruction TEXT,
  task_client_information TEXT,
  task_client_property_information TEXT,

  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (travel_from) REFERENCES locations(id) ON DELETE SET NULL

);

CREATE TABLE IF NOT EXISTS task_comments (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  comment VARCHAR(65000),
  is_read BOOLEAN,
  staff_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  -- comment VARCHAR(65000),
  -- is_read BOOLEAN,
  staff_id TEXT,
  images TEXT, -- It will hold image link
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);


CREATE TABLE IF NOT EXISTS task_instructions (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  ques TEXT,
  resp_type TEXT,
  reply TEXT,
  replied_at TEXT, -- It will hold date time value but stored as text in DB
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);
`;
db.exec(initSql, (err) => {
  if (err) console.error('DB init error', err);
});

// Simple helpers
function runSql(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}
function allSql(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}
function getSql(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Seed endpoint (for ease)
app.get('/api/seed', async (req, res) => {
  console.log('I am getting seed');
  try {
    // --- Staff ---
    const staff = [
      { name: 'Manish Kumar', email: 'manish@example.com', phone: '+919876543210', role: 'cleaner', color: '#7C3AED' },
      { name: 'Roxy', email: 'roxy@example.com', phone: '+919234567890', role: 'cleaner', color: '#10B981' },
      { name: 'Rio', email: 'rio@example.com', phone: '+918888888888', role: 'supervisor', color: '#059669' },
      { name: 'Pratik', email: 'pratik@example.com', phone: '+917777777777', role: 'manager', color: '#06B6D4' }
    ];

    const staffIds = [];
    for (const s of staff) {
      const id = uuidv4();
      staffIds.push(id);
      await runSql(
        'INSERT OR IGNORE INTO staff (id, name, email, phone, role, color) VALUES (?, ?, ?, ?, ?, ?)',
        [id, s.name, s.email, s.phone, s.role, s.color]
      );
    }

    // --- Teams ---
    const teamId = uuidv4();
    await runSql('INSERT OR IGNORE INTO teams (id, name, supervisor_id) VALUES (?, ?, ?)',
      [teamId, 'Morning Team', staffIds[2]]);

    // --- Team Members ---
    for (const sid of [staffIds[0], staffIds[1]]) {
      await runSql('INSERT OR IGNORE INTO team_members (id, team_id, staff_id) VALUES (?, ?, ?)',
        [uuidv4(), teamId, sid]);
    }

    // --- Clients ---
    const clientId = uuidv4();
    await runSql(
      `INSERT OR IGNORE INTO clients
       (id, client_name, company, email, phone, client_instruction, client_information, property_information)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        'ACME Corp',
        'ACME',
        'client@acme.com',
        '+911234567890',
        'Please ensure floors are cleaned before 9 AM.',
        'Main client in Delhi NCR region.',
        'Office building with 3 floors and 2 restrooms.'
      ]
    );

    // --- Locations ---
    const locationId = uuidv4();
    await runSql(
      `INSERT OR IGNORE INTO locations
       (id, title, address, lat, lng, unit_no, radius_meters, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        locationId,
        'ACME HQ',
        '123 Main Street, Delhi',
        28.6139,
        77.2090,
        'Unit 5A',
        100,
        'Main work site'
      ]
    );

    // --- Tasks ---
    const now = new Date();
    const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 30).toISOString();
    const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30).toISOString();
    const taskId = uuidv4();

    await runSql(
      `INSERT OR IGNORE INTO tasks
        (id, task_name, assignment_type, staff_id, team_id, client_id, location_id,
         start_time, end_time, publish, shift_instructions, color, started_at, stopped_at,
         travel_from, travel_dist, travel_duration, payment_type, payment_amount, payment_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        'Morning Cleaning',
        'team',
        staffIds[0],
        teamId,
        clientId,
        locationId,
        startTime,
        endTime,
        1,
        'Ensure lobby and restroom are clean.',
        '#7C3AED',
        null,
        null,
        locationId,
        1.2,
        15.5,
        'hourly',
        '300',
        now.toISOString()
      ]
    );

    // --- Task Comments ---
    await runSql(
      `INSERT OR IGNORE INTO task_comments (id, task_id, comment, is_read, staff_id)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), taskId, 'All done, looks great!', 0, staffIds[0]]
    );

    // --- Images ---
    await runSql(
      `INSERT OR IGNORE INTO images (id, task_id, staff_id, images)
       VALUES (?, ?, ?, ?)`,
      [uuidv4(), taskId, staffIds[0], 'https://dummyimage.com/600x400/000/fff&text=After+Cleaning']
    );

    // --- Task Instructions ---
    await runSql(
      `INSERT OR IGNORE INTO task_instructions
       (id, task_id, ques, resp_type, reply, replied_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), taskId, 'Was the mop replaced?', 'yes_no', 'Yes', now.toISOString()]
    );

    res.json({ ok: true, message: 'Seeded all data successfully.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

/* -----------------------------
👥 Staff CRUD
----------------------------- */
app.get('/api/staff', async (_, res) => {
  try {
    const rows = await allSql('SELECT * FROM staff');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/staff/:id', async (req, res) => {
  try {
    const rows = await getSql('SELECT * FROM staff WHERE id=?', [req.params.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/staff', async (req, res) => {
  try {
    const id = uuidv4();
    const { name, email, phone, role, color, password_hash } = req.body;
    await runSql(
      'INSERT INTO staff (id, name, email, phone, role, color, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, email, phone, role, color, password_hash || null]
    );
    const row = await getSql('SELECT * FROM staff WHERE id=?', [id]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/staff/:id', async (req, res) => {
  try {
    const { name, email, phone, role, color, password_hash } = req.body;
    console.log('Updating staff ' + req.params.id, req.body);
    await runSql(
      'UPDATE staff SET name=?, email=?, phone=?, role=?, color=?, password_hash=? WHERE id=?',
      [name, email, phone, role, color, password_hash, req.params.id]
    );
    const row = await getSql('SELECT * FROM staff WHERE id=?', [req.params.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/staff/:id', async (req, res) => {
  try {
    await runSql('DELETE FROM staff WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* -----------------------------
👥 Teams Members CRUD
----------------------------- */
app.get('/api/team_members', async (_, res) => {
  try {
    const team_members = await allSql(`
      SELECT tm.id, tm.team_id, tm.staff_id, s.name, s.email, s.role
      FROM team_members tm
      JOIN staff s ON tm.staff_id = s.id;
    `);
    res.json(team_members);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* -----------------------------
👥 Teams CRUD (with members)
----------------------------- */
app.get('/api/teams', async (_, res) => {
  try {
    const teams = await allSql(`
      SELECT t.*, s.name AS supervisor_name, s.id AS supervisor_id,
      (SELECT COUNT(id) FROM team_members WHERE team_id = t.id) AS member_count
      FROM teams t
      LEFT JOIN staff s ON t.supervisor_id = s.id
      GROUP BY t.id;
    `);

    console.log(teams);
    res.json(teams);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/teams/:id', async (req, res) => {
  try {
    const team = await getSql(`
      SELECT t.*, s.name AS supervisor_name, s.id AS supervisor_id
      FROM teams t
      LEFT JOIN staff s ON t.supervisor_id = s.id
      WHERE t.id=?
    `, [req.params.id]);

    const members = await allSql(`
      SELECT tm.staff_id, s.name, s.role
      FROM team_members tm
      LEFT JOIN staff s ON tm.staff_id = s.id
      WHERE tm.team_id=?
    `, [req.params.id]);

    team.member_count = members?.length || 0;

    res.json({ ...team, members });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/teams', async (req, res) => {
  try {
    const id = uuidv4();
    const { name, description, status, supervisor_id, member_ids = [] } = req.body;
    await runSql('INSERT INTO teams (id, name, supervisor_id) VALUES (?, ?, ?)', [id, name, supervisor_id]);

    for (const mid of member_ids) {
      await runSql('INSERT INTO team_members (id, team_id, staff_id) VALUES (?, ?, ?)', [uuidv4(), id, mid]);
    }

    const team = await getSql('SELECT * FROM teams WHERE id=?', [id]);
    res.json({ ...team, members: member_ids });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/teams/:id', async (req, res) => {
  try {
    const { name, description, status, supervisor_id, member_ids = [] } = req.body;
    await runSql('UPDATE teams SET name=?, supervisor_id=? description=? status=? WHERE id=?', [name, supervisor_id, description, status, req.params.id]);

    // Reset members
    await runSql('DELETE FROM team_members WHERE team_id=?', [req.params.id]);
    for (const mid of member_ids) {
      await runSql('INSERT INTO team_members (id, team_id, staff_id) VALUES (?, ?, ?)', [uuidv4(), req.params.id, mid]);
    }

    const team = await getSql(`SELECT t.*, s.name AS supervisor_name, s.id AS supervisor_id,
      (SELECT COUNT(id) FROM team_members WHERE team_id = t.id) AS member_count
      FROM teams t
      LEFT JOIN staff s ON t.supervisor_id = s.id
      WHERE t.id=?`, [req.params.id]);
    res.json({ ...team, members: member_ids });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/teams/:id', async (req, res) => {
  try {
    await runSql('DELETE FROM team_members WHERE team_id=?', [req.params.id]);
    await runSql('DELETE FROM teams WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* -----------------------------
   🧾 Clients CRUD
----------------------------- */
app.get('/api/clients', async (_, res) => {
  try {
    const rows = await allSql('SELECT * FROM clients');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/clients/:id', async (req, res) => {
  try {
    const rows = await getSql('SELECT * FROM clients WHERE id=?', [req.params.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/clients', async (req, res) => {
  try {
    const id = uuidv4();
    const { client_name, company, email, phone, abn, acn, client_instruction, client_information, property_information } = req.body;
    await runSql(
      'INSERT INTO clients (id, client_name, company, email, phone, abn, acn, client_instruction, client_information, property_information) VALUES (?,?,?,?,?,?,?,?)',
      [id, client_name, company, email, phone, abn, acn, client_instruction, client_information, property_information]
    );
    const row = await getSql('SELECT * FROM clients WHERE id=?', [id]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const { client_name, company, email, phone, abn, acn, client_instruction, client_information, property_information } = req.body;
    await runSql(
      'UPDATE clients SET client_name=?, company=?, email=?, phone=?, abn=?, acn=?, client_instruction=?, client_information=?, property_information=? WHERE id=?',
      [client_name, company, email, phone, abn, acn, client_instruction, client_information, property_information, req.params.id]
    );
    const row = await getSql('SELECT * FROM clients WHERE id=?', [req.params.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    await runSql('DELETE FROM clients WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* -----------------------------
   📋 Tasks CRUD (All Columns)
----------------------------- */
app.get('/api/tasks', async (_, res) => {
  try {
    const rows = await allSql(`
      SELECT t.*, s.name AS staff_name, c.client_name, l.title AS location_title, tm.name AS team_supervisor
      FROM tasks t
      LEFT JOIN staff s ON t.staff_id = s.id
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN locations l ON t.location_id = l.id
      LEFT JOIN teams te ON t.team_id = te.id
      LEFT JOIN staff tm ON te.supervisor_id = tm.id
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tasks/:id', async (req, res) => {
  try {
    const rows = await getSql(`
      SELECT t.*, s.name AS staff_name, c.client_name, l.title AS location_title, tm.name AS team_supervisor
      FROM tasks t
      LEFT JOIN staff s ON t.staff_id = s.id
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN locations l ON t.location_id = l.id
      LEFT JOIN teams te ON t.team_id = te.id
      LEFT JOIN staff tm ON te.supervisor_id = tm.id
      WHERE id=?
    `, [req.params.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const id = uuidv4();
    const fields = [
      'task_name', 'assignment_type', 'staff_id', 'team_id', 'client_id', 'location_id',
      'start_time', 'end_time', 'publish', 'shift_instructions', 'color',
      'started_at', 'stopped_at', 'travel_from', 'travel_dist', 'travel_duration',
      'payment_type', 'payment_amount', 'payment_date',
      'task_client_name', 'task_client_company', 'task_client_email', 'task_client_phone',
      'task_client_abn', 'task_client_acn', 'task_client_instruction',
      'task_client_information', 'task_client_property_information'
    ];
    const values = fields.map(k => req.body[k] || null);

    await runSql(
      `INSERT INTO tasks (${fields.join(',')}, id)
       VALUES (${fields.map(() => '?').join(',')}, ?)`,
      [...values, id]
    );

    // Handle task_team_members if provided
    if (Array.isArray(req.body.task_team_members)) {
      for (const m of req.body.task_team_members) {
        await runSql(
          'INSERT INTO task_team_members (id, team_id, task_id, staff_id) VALUES (?, ?, ?, ?)',
          [uuidv4(), m.team_id || req.body.team_id, id, m.staff_id]
        );
      }
    }

    const row = await getSql('SELECT * FROM tasks WHERE id=?', [id]);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const fields = [
      'task_name', 'assignment_type', 'staff_id', 'team_id', 'client_id', 'location_id',
      'start_time', 'end_time', 'publish', 'shift_instructions', 'color',
      'started_at', 'stopped_at', 'travel_from', 'travel_dist', 'travel_duration',
      'payment_type', 'payment_amount', 'payment_date',
      'task_client_name', 'task_client_company', 'task_client_email', 'task_client_phone',
      'task_client_abn', 'task_client_acn', 'task_client_instruction',
      'task_client_information', 'task_client_property_information'
    ];

    const setClause = fields.map(f => `${f}=?`).join(', ');
    const values = fields.map(k => req.body[k] || null);

    await runSql(`UPDATE tasks SET ${setClause} WHERE id=?`, [...values, req.params.id]);

    // Reset and reinsert task_team_members if provided
    await runSql('DELETE FROM task_team_members WHERE task_id=?', [req.params.id]);
    if (Array.isArray(req.body.task_team_members)) {
      for (const m of req.body.task_team_members) {
        await runSql(
          'INSERT INTO task_team_members (id, team_id, task_id, staff_id) VALUES (?, ?, ?, ?)',
          [uuidv4(), m.team_id || req.body.team_id, req.params.id, m.staff_id]
        );
      }
    }

    const row = await getSql('SELECT * FROM tasks WHERE id=?', [req.params.id]);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await runSql('DELETE FROM task_team_members WHERE task_id=?', [req.params.id]);
    await runSql('DELETE FROM tasks WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* -----------------------------
   💬 Task Comments, 🖼️ Images, 📝 Instructions
----------------------------- */
const genericCrud = (table, fields) => {
  app.get(`/api/${table}`, async (_, res) => {
    try {
      const rows = await allSql(`SELECT * FROM ${table}`);
      res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post(`/api/${table}`, async (req, res) => {
    try {
      const id = uuidv4();
      const values = fields.map(f => req.body[f] || null);
      await runSql(
        `INSERT INTO ${table} (${fields.join(',')}, id) VALUES (${fields.map(() => '?').join(',')}, ?)`,
        [...values, id]
      );
      const row = await getSql(`SELECT * FROM ${table} WHERE id=?`, [id]);
      res.json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.put(`/api/${table}/:id`, async (req, res) => {
    try {
      const setClause = fields.map(f => `${f}=?`).join(', ');
      const values = fields.map(f => req.body[f] || null);
      await runSql(`UPDATE ${table} SET ${setClause} WHERE id=?`, [...values, req.params.id]);
      const row = await getSql(`SELECT * FROM ${table} WHERE id=?`, [req.params.id]);
      res.json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.delete(`/api/${table}/:id`, async (req, res) => {
    try {
      await runSql(`DELETE FROM ${table} WHERE id=?`, [req.params.id]);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
};

// Initialize for smaller tables
genericCrud('task_comments', ['task_id', 'comment', 'is_read', 'staff_id']);
genericCrud('images', ['task_id', 'staff_id', 'images']);
genericCrud('task_instructions', ['task_id', 'ques', 'resp_type', 'reply', 'replied_at']);
genericCrud('task_team_members', ['team_id', 'task_id', 'staff_id']);

const PORT = import.meta.env.PORT || 4000;
app.listen(PORT, () => {
  console.log('Backend running on port', PORT);
});