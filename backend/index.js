import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import bodyParser from 'body-parser';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import dayjs from "dayjs";

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('------dir name-------', __dirname);

const DB_PATH = path.join(__dirname, 'data.sqlite');

console.log('------DB_PATH-------', DB_PATH);

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

  recurring_settings TEXT,

  FOREIGN KEY (recurring_settings) REFERENCES recurring_task_settings(id) ON DELETE SET NULL,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (travel_from) REFERENCES locations(id) ON DELETE SET NULL

);

CREATE TABLE IF NOT EXISTS recurring_task_settings (
  id TEXT PRIMARY KEY,
  request_freq TEXT,
  monday BOOLEAN,
  tuesday BOOLEAN,
  wednesday BOOLEAN,
  thrusday BOOLEAN,
  friday BOOLEAN,
  saturday BOOLEAN,
  sunday BOOLEAN,
  occurrences INTEGER,
  close_date TEXT,
  parent_task TEXT,
  task_length TEXT,
  details TEXT,

  FOREIGN KEY (parent_task) REFERENCES tasks(id) ON DELETE SET NULL
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
  try {
    // --- Staff ---
    const staff = [
      { name: 'Manish Kumar', email: 'manish@example.com', phone: '+919876543210', role: 'cleaner', color: '#7C3AED' },
      { name: 'Roxy', email: 'roxy@example.com', phone: '+919234567890', role: 'cleaner', color: '#10B981' },
      { name: 'Rio', email: 'rio@example.com', phone: '+918888888888', role: 'Supervisor', color: '#059669' },
      { name: 'Pratik', email: 'pratik@example.com', phone: '+917777777777', role: 'Supervisor', color: '#06B6D4' },
      { name: 'Test', email: 'test@example.com', phone: '+9177777788777', role: 'Supervisor', color: '#06B6D2' },
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
    await runSql('INSERT OR IGNORE INTO teams (id, name, description, status, supervisor_id) VALUES (?, ?, ?, ?, ?)',
      [teamId, 'Morning Team', 'Handles morning shifts', 'active', staffIds[2]]);

    // --- Team Members ---
    for (const sid of [staffIds[0], staffIds[1]]) {
      await runSql('INSERT OR IGNORE INTO team_members (id, team_id, staff_id) VALUES (?, ?, ?)',
        [uuidv4(), teamId, sid]);
    }

    // --- Clients ---
    const clientId = uuidv4();
    await runSql(
      `INSERT OR IGNORE INTO clients
       (id, client_name, company, email, phone, abn, acn, client_instruction, client_information, property_information)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        'ACME Corp',
        'ACME Pvt Ltd',
        'client@acme.com',
        '+911234567890',
        '12345678901',
        '987654321',
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
         start_time, end_time, publish, shift_instructions, color,
         started_at, stopped_at, travel_from, travel_dist, travel_duration,
         payment_type, payment_amount, payment_date,
         task_client_name, task_client_company, task_client_email, task_client_phone,
         task_client_abn, task_client_acn, task_client_instruction, task_client_information, task_client_property_information)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        now.toISOString(),
        'ACME Corp',
        'ACME Pvt Ltd',
        'client@acme.com',
        '+911234567890',
        '12345678901',
        '987654321',
        'Please ensure floors are cleaned before 9 AM.',
        'Main client in Delhi NCR region.',
        'Office building with 3 floors and 2 restrooms.'
      ]
    );

    // --- Task Team Members ---
    for (const sid of [staffIds[0], staffIds[1]]) {
      await runSql('INSERT OR IGNORE INTO task_team_members (id, team_id, task_id, staff_id) VALUES (?, ?, ?, ?)',
        [uuidv4(), teamId, taskId, sid]);
    }

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
   📍 Locations CRUD
----------------------------- */
app.get('/api/locations', async (_, res) => {
  try {
    const rows = await allSql('SELECT * FROM locations');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/locations/:id', async (req, res) => {
  try {
    const row = await getSql('SELECT * FROM locations WHERE id=?', [req.params.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/locations', async (req, res) => {
  try {
    const id = uuidv4();
    const { title, address, lat, lng, unit_no, radius_meters, comment } = req.body;
    await runSql(
      'INSERT INTO locations (id, title, address, lat, lng, unit_no, radius_meters, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, address, lat, lng, unit_no, radius_meters, comment]
    );
    const row = await getSql('SELECT * FROM locations WHERE id=?', [id]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/locations/:id', async (req, res) => {
  try {
    const { title, address, lat, lng, unit_no, radius_meters, comment } = req.body;
    await runSql(
      'UPDATE locations SET title=?, address=?, lat=?, lng=?, unit_no=?, radius_meters=?, comment=? WHERE id=?',
      [title, address, lat, lng, unit_no, radius_meters, comment, req.params.id]
    );
    const row = await getSql('SELECT * FROM locations WHERE id=?', [req.params.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/locations/:id', async (req, res) => {
  try {
    await runSql('DELETE FROM locations WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* -----------------------------
   📋 Tasks CRUD (All Columns)
----------------------------- */
app.get('/api/tasks', async (_, res) => {
  try {
    const rows = await allSql(`
      SELECT t.*, s.name AS staff_name, c.client_name AS client_name, l.title AS location_title, tm.name AS team_supervisor
      FROM tasks t
      LEFT JOIN staff s ON t.staff_id = s.id
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN locations l ON t.location_id = l.id
      LEFT JOIN teams te ON t.team_id = te.id
      LEFT JOIN staff tm ON te.supervisor_id = tm.id
    `);

      // Add task_team_members for each task
      for (const task of rows) {
        const teamMembers = await allSql('SELECT staff_id FROM task_team_members WHERE task_id = ?', [task.id]);
        task.task_team_members = teamMembers.map(tm => tm.staff_id);
      }

    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tasks/:id', async (req, res) => {
  try {
    const task = await getSql('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const teamMembers = await allSql('SELECT staff_id FROM task_team_members WHERE task_id = ?', [req.params.id]);
    task.task_team_members = teamMembers.map(tm => tm.staff_id);

    console.log('---teamMembers get----');
    console.log(teamMembers);
    console.log('---teamMembers----');

    console.log('---task get----');
    console.log(task);
    console.log('---task----');

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// app.get('/api/tasks/:id', async (req, res) => {
//   try {
//     const rows = await getSql(`
//       SELECT t.*, s.name AS staff_name, c.client_name, l.title AS location_title, tm.name AS team_supervisor
//       FROM tasks t
//       LEFT JOIN staff s ON t.staff_id = s.id
//       LEFT JOIN clients c ON t.client_id = c.id
//       LEFT JOIN locations l ON t.location_id = l.id
//       LEFT JOIN teams te ON t.team_id = te.id
//       LEFT JOIN staff tm ON te.supervisor_id = tm.id
//       WHERE id=?
//     `, [req.params.id]);
//     res.json(rows);
//   } catch (e) { res.status(500).json({ error: e.message }); }
// });

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
      for (const staffId of req.body.task_team_members) {
        await runSql(
          'INSERT INTO task_team_members (id, team_id, task_id, staff_id) VALUES (?, ?, ?, ?)',
          [uuidv4(), null, id, staffId]
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
      for (const staffId of req.body.task_team_members) {
        if (staffId) {
          await runSql(
            'INSERT INTO task_team_members (id, team_id, task_id, staff_id) VALUES (?, ?, ?, ?)',
            [uuidv4(), null, req.params.id, staffId]
          );
        }
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
   📋 Task Instructions Tasks
----------------------------- */
app.get('/api/task_instructions/:taskid', async (req, res) => {
  try {
    const taskInstructions = await allSql('SELECT * FROM task_instructions WHERE task_id = ?', [req.params.taskid]);
    if (!taskInstructions) {
      return res.status(404).json({ error: 'taskInstructions not found' });
    }
    res.json(taskInstructions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/task_instructions', async (req, res) => {
  try {
    const id = uuidv4();
    const fields = ['task_id', 'ques', 'resp_type', 'reply', 'replied_at'];
    const values = fields.map(k => req.body[k] || null);

    await runSql(
      `INSERT INTO task_instructions (${fields.join(',')}, id)
       VALUES (${fields.map(() => '?').join(',')}, ?)`,
      [...values, id]
    );

    const row = await getSql('SELECT * FROM task_instructions WHERE id=?', [id]);
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/task_instructions/:id', async (req, res) => {
  try {
    const fields = ['task_id', 'ques', 'resp_type', 'reply', 'replied_at'];

    const setClause = fields.map(f => `${f}=?`).join(', ');
    const values = fields.map(k => req.body[k] || null);

    await runSql(`UPDATE task_instructions SET ${setClause} WHERE id=?`, [...values, req.params.id]);

    const row = await getSql('SELECT * FROM task_instructions WHERE id=?', [req.params.id]);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/task_instructions/:id', async (req, res) => {
  try {
    await runSql('DELETE FROM task_instructions WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});



/* -----------------------------
   📋 Recurring Tasks
----------------------------- */
app.get("/api/recurring/:taskId", async (req, res) => {
  try {
    const recurringTaskSettingsForTask = await allSql("SELECT * FROM recurring_task_settings WHERE parent_task = ?", [req.params.taskId]);
    if (!recurringTaskSettingsForTask || recurringTaskSettingsForTask.length === 0) return res.json({});

    let settingIds = [];
    for (let recurringTaskSettingForTask of recurringTaskSettingsForTask) {
      settingIds.push(recurringTaskSettingForTask.id);
    }

    // Build dynamic placeholders for IN clause
    const placeholders = settingIds.map(() => '?').join(',');

    // Fetch all child tasks for all recurring settings
    const children = await allSql(
      `SELECT id, start_time, end_time, team_id, staff_id, client_id, location_id
      FROM tasks
      WHERE recurring_settings IN (${placeholders})
      ORDER BY start_time`,
      settingIds
    );

    res.json({ row: recurringTaskSettingsForTask, children });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// app.delete('/api/recurring/:id', async (req, res) => {
//   try {
//     const recId = req.params.id;
//     // delete generated tasks first
//     await runSql('DELETE FROM tasks WHERE recurring_settings = ?', [recId]);
//     // delete recurring settings
//     await runSql('DELETE FROM recurring_task_settings WHERE id = ?', [recId]);
//     res.json({ ok: true });
//   } catch (e) {
//     console.error('delete recurring error', e);
//     res.status(500).json({ error: e.message });
//   }
// });

app.delete('/api/recurring_setting/:id', async (req, res) => {
  try {
    const recId = req.params.id;

    const today = dayjs().startOf('day').toISOString();

    const futureTasks = await allSql(
      `SELECT id FROM tasks
       WHERE recurring_settings = ?
       AND start_time > ?`,
      [recId, today]
    );

    for (const task of futureTasks) {
      await runSql('DELETE FROM task_team_members WHERE task_id = ?', [task.id]);
      await runSql('DELETE FROM tasks WHERE id = ?', [task.id]);
    }

    await runSql('DELETE FROM recurring_task_settings WHERE id = ?', [recId]);

    res.json({ ok: true, deletedTasks: futureTasks.length });
  } catch (e) {
    console.error('delete recurring setting error', e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/recurring_setting/:id/tasks', async (req, res) => {
  try {
    const recId = req.params.id;
    const {
      team_id,
      staff_id,
      task_team_members,
      client_fields,
      new_start_time,
      new_end_time,
      location_id
    } = req.body;

    const tasks = await allSql(
      `SELECT id FROM tasks WHERE recurring_settings = ?`,
      [recId]
    );

    for (const t of tasks) {
      const taskId = t.id;

      if (team_id) {
        await runSql('UPDATE tasks SET assignment_type=?, team_id=?, staff_id=? WHERE id=?', ["team", team_id, staff_id, taskId]);
        await runSql('DELETE FROM task_team_members WHERE task_id=?', [taskId]);

        if (Array.isArray(task_team_members)) {
          for (const mid of task_team_members) {
            await runSql(
              'INSERT INTO task_team_members (id, team_id, task_id, staff_id) VALUES (?,?,?,?)',
              [uuidv4(), team_id, taskId, mid]
            );
          }
        }
      } else if (staff_id) {
        await runSql('UPDATE tasks SET staff_id=?, team_id=NULL WHERE id=?', [staff_id, taskId]);
        await runSql('DELETE FROM task_team_members WHERE task_id=?', [taskId]);

        if (Array.isArray(task_team_members)) {
          for (const mid of task_team_members) {
            await runSql(
              'INSERT INTO task_team_members (id, team_id, task_id, staff_id) VALUES (?,?,?,?)',
              [uuidv4(), team_id, taskId, mid]
            );
          }
        }
      }

      if (client_fields) {
        const {
          task_client_name,
          task_client_company,
          task_client_email,
          task_client_phone,
          task_client_abn,
          task_client_acn,
          task_client_instruction,
          task_client_information,
          task_client_property_information
        } = client_fields;

        await runSql(
          `UPDATE tasks SET
            task_client_name=?,
            task_client_company=?,
            task_client_email=?,
            task_client_phone=?,
            task_client_abn=?,
            task_client_acn=?,
            task_client_instruction=?,
            task_client_information=?,
            task_client_property_information=?
           WHERE id=?`,
          [
            task_client_name,
            task_client_company,
            task_client_email,
            task_client_phone,
            task_client_abn,
            task_client_acn,
            task_client_instruction,
            task_client_information,
            task_client_property_information,
            taskId
          ]
        );
      }

      if (new_start_time && new_end_time) {
        await runSql(
          'UPDATE tasks SET start_time=?, end_time=? WHERE id=?',
          [new_start_time, new_end_time, taskId]
        );
      }

      // [PATCH] Update task_length in recurring_task_settings if new_start_time & new_end_time are provided
      if (new_start_time && new_end_time) {
        const lengthMinutes = dayjs(new_end_time).diff(dayjs(new_start_time), "minute");
        await runSql(
          'UPDATE recurring_task_settings SET task_length=? WHERE id=?',
          [String(lengthMinutes), recId]
        );
      }

      if (location_id) {
        await runSql(
          'UPDATE tasks SET location_id=? WHERE id=?',
          [location_id, taskId]
        );
      }
    }

    // [PATCH] Update details in recurring_task_settings if team_id, staff_id or task_team_members change
    let detailsStr = "";
    if (team_id || staff_id) {
      if (team_id) {
        const team = await getSql('SELECT name FROM teams WHERE id=?', [team_id]);
        detailsStr = team?.name ? team.name : "";
      } else if (staff_id) {
        const st = await getSql('SELECT name, role FROM staff WHERE id=?', [staff_id]);
        if (st) {
          detailsStr = st.name + " (S)";
        }
      }
  
      let memberNames = [];
      if (Array.isArray(task_team_members)) {
        for (const mid of task_team_members) {
          const st = await getSql('SELECT name, role FROM staff WHERE id=?', [mid]);
          if (st) memberNames.push(st.name);
        }
      }
  
      if (detailsStr && memberNames.length > 0) {
        detailsStr = detailsStr + " - " + memberNames.join(", ");
      } else if (!detailsStr) {
        detailsStr = memberNames.join(", ");
      }
  
      await runSql(
        'UPDATE recurring_task_settings SET details=? WHERE id=?',
        [detailsStr, recId]
      );
    }


    res.json({ ok: true, updated: tasks.length });
  } catch (e) {
    console.error('update recurring tasks error', e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/tasks/:id/recurring", async (req, res) => {
  const taskId = req.params.id;
  const {
    frequency,
    selectedDays,
    occurrences,
    closeDate,
    startingDate,
    parent_task
  } = req.body;

  try {
    const task = await getSql('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    let selectedDayRecurringTaskSettingRecIdMap = {};
    for (let selectedDay of selectedDays) {
      // Save recurring settings before generating tasks
      let recId = uuidv4();
      // Compute finalCloseDate, taskLengthStr, detailsStr
      const finalCloseDate = closeDate || null;
      const taskLengthMinutes = dayjs(task.end_time).diff(dayjs(task.start_time), "minute");
      const taskLengthStr = String(taskLengthMinutes);
      let detailsStr = "";
      if (task.team_id) {
        const team = await getSql('SELECT name FROM teams WHERE id=?', [task.team_id]);
        detailsStr = team?.name ? team.name : "";
      }
      const originalMembers = await allSql('SELECT staff_id FROM task_team_members WHERE task_id=?', [taskId]);
      const memberIds = originalMembers.map(m => m.staff_id);
      let nameParts = [];

      let supervisorStaffDetails = await getSql('SELECT name FROM staff WHERE id=?', [task.staff_id]);
      if (supervisorStaffDetails && supervisorStaffDetails.name) {
        nameParts.push(supervisorStaffDetails.name + " (S)");
      }

      for (const sid of memberIds) {
        const st = await getSql('SELECT name, role FROM staff WHERE id=?', [sid]);
        if (st) {
          nameParts.push(st.name);
        }
      }

      if (detailsStr) {
        detailsStr = detailsStr + " - " + nameParts.join(", ");
      } else {
        detailsStr = nameParts.join(", ");
      }


      await runSql(
        `INSERT INTO recurring_task_settings
         (id, request_freq, monday, tuesday, wednesday, thrusday, friday, saturday, sunday,
          occurrences, close_date, parent_task, task_length, details)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          recId,
          frequency,
          selectedDay === 1 ? 1 : 0,
          selectedDay === 2 ? 1 : 0,
          selectedDay === 3 ? 1 : 0,
          selectedDay === 4 ? 1 : 0,
          selectedDay === 5 ? 1 : 0,
          selectedDay === 6 ? 1 : 0,
          selectedDay === 0 ? 1 : 0,
          occurrences || null,
          finalCloseDate,
          taskId,
          taskLengthStr,
          detailsStr
        ]
      );

      selectedDayRecurringTaskSettingRecIdMap[selectedDay] = recId;
    }

    let start = dayjs(startingDate);
    let end = closeDate ? dayjs(closeDate) : null;

    if (!end) {
      const calculatedEndDate = start.day(selectedDays[selectedDays.length - 1]).add((occurrences || 1), 'week');
      end = calculatedEndDate.clone();
    }

    console.log('---startingDate---- ', start);
    console.log('------start end-------- ', end);

    let created = 0;
    let results = [];
    let selectedDayLastTaskDateMap = {}

    while (true) {
      let anyRecurringCreated = false;
      for (const weekday of selectedDays) {
        console.log('In Loop 1 start', start);
        
        
        let nextDate = start.day(weekday);
        console.log('In Loop 2 nextDate', nextDate);

        console.log('In loop 2 dayjs', dayjs());

        if (nextDate.isBefore(dayjs(startingDate)) || nextDate.isSame(dayjs(startingDate))) {
          continue;
          nextDate = nextDate.add(1, 'week');
        }

        console.log('In Loop 3 nextDate', nextDate);

        // if (weekday === dayjs().day()) {
        //   nextDate = dayjs();
        // }

        // console.log('In Loop 4 nextDate', nextDate);

        if (end && nextDate.isAfter(end)) break;

        const originalStart = dayjs(task.start_time);
        const originalEnd = dayjs(task.end_time);

        const newStart = nextDate
          .hour(originalStart.hour())
          .minute(originalStart.minute())
          .second(0)
          .toISOString();

        const newEnd = nextDate
          .hour(originalEnd.hour())
          .minute(originalEnd.minute())
          .second(0)
          .toISOString();

        console.log('In Loop 4 newStart', newStart);
        console.log('In Loop 4 newEnd', newEnd);

        const newId = uuidv4();

        await runSql(
          `INSERT INTO tasks
           (id, task_name, assignment_type, staff_id, team_id, client_id, location_id,
            start_time, end_time, publish, shift_instructions, color,
            started_at, stopped_at, travel_from, travel_dist, travel_duration,
            payment_type, payment_amount, payment_date,
            task_client_name, task_client_company, task_client_email, task_client_phone,
            task_client_abn, task_client_acn, task_client_instruction,
            task_client_information, task_client_property_information, recurring_settings)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            newId,
            task.task_name,
            task.assignment_type,
            task.staff_id,
            task.team_id,
            task.client_id,
            task.location_id,
            newStart,
            newEnd,
            task.publish,
            task.shift_instructions,
            task.color,
            null,
            null,
            task.travel_from,
            task.travel_dist,
            task.travel_duration,
            task.payment_type,
            task.payment_amount,
            task.payment_date,
            task.task_client_name,
            task.task_client_company,
            task.task_client_email,
            task.task_client_phone,
            task.task_client_abn,
            task.task_client_acn,
            task.task_client_instruction,
            task.task_client_information,
            task.task_client_property_information,
            selectedDayRecurringTaskSettingRecIdMap[weekday]
          ]
        );

        selectedDayLastTaskDateMap[weekday] = newEnd;

        const members = await allSql(
          'SELECT staff_id FROM task_team_members WHERE task_id=?',
          [taskId]
        );

        for (const m of members) {
          await runSql(
            'INSERT INTO task_team_members (id, team_id, task_id, staff_id) VALUES (?,?,?,?)',
            [uuidv4(), task.team_id, newId, m.staff_id]
          );
        }

        anyRecurringCreated = true;

        results.push({ id: newId, start_time: newStart, end_time: newEnd });
      }

      console.log('__selectedDays__');
      console.log(selectedDays);

      console.log('created: ', created);
      console.log('occurrences: ', occurrences);
      console.log('start: ', start);
      console.log('end: ', end);
      console.log('frequency: ', frequency);



      if (anyRecurringCreated) {
        created++;
      }

      if (occurrences && created >= occurrences) break;
      if (end && start.add(frequency, "week").isAfter(end)) break;

      start = start.add(frequency, "week");

      console.log('start after: ', start);
      console.log('end after: ', end);
    }

    // After generating all tasks, set close date automatically if not provided
    if (!closeDate && results.length > 0) {
      for (const recKey of Object.keys(selectedDayRecurringTaskSettingRecIdMap)) {
        const rid = selectedDayRecurringTaskSettingRecIdMap[recKey];
        let lastTaskDateForCurrentWeekday = selectedDayLastTaskDateMap[recKey];
        await runSql(
          'UPDATE recurring_task_settings SET close_date=? WHERE id=?',
          [lastTaskDateForCurrentWeekday, rid]
        );
      }
    }

    res.json({ created: results.length, tasks: results });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});


/* -----------------------------
   💬 Task Comments
----------------------------- */
app.get('/api/task_comments/:taskid', async (req, res) => {
  try {
    const taskInstructions = await allSql('SELECT * FROM task_comments WHERE task_id = ?', [req.params.taskid]);
    if (!taskInstructions) {
      return res.status(404).json({ error: 'taskInstructions not found' });
    }
    res.json(taskInstructions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/task_comments', async (req, res) => {
  try {
    const id = uuidv4();
    const fields = ['task_id', 'comment', 'is_read', 'staff_id'];
    const values = fields.map(k => req.body[k] || null);

    await runSql(
      `INSERT INTO task_comments (${fields.join(',')}, id)
       VALUES (${fields.map(() => '?').join(',')}, ?)`,
      [...values, id]
    );

    const row = await getSql('SELECT * FROM task_comments WHERE id=?', [id]);
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/task_comments/:id', async (req, res) => {
  try {
    const fields = ['task_id', 'comment', 'is_read', 'staff_id'];

    const setClause = fields.map(f => `${f}=?`).join(', ');
    const values = fields.map(k => req.body[k] || null);

    await runSql(`UPDATE task_comments SET ${setClause} WHERE id=?`, [...values, req.params.id]);

    const row = await getSql('SELECT * FROM task_comments WHERE id=?', [req.params.id]);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/task_comments/:id', async (req, res) => {
  try {
    await runSql('DELETE FROM task_comments WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


/* -----------------------------
  🖼️ Images
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
// genericCrud('task_comments', ['task_id', 'comment', 'is_read', 'staff_id']);
genericCrud('images', ['task_id', 'staff_id', 'images']);
// genericCrud('task_instructions', ['task_id', 'ques', 'resp_type', 'reply', 'replied_at']);
genericCrud('task_team_members', ['team_id', 'task_id', 'staff_id']);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log('Backend running on port', PORT);
});