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


-- CREATE TABLE IF NOT EXISTS task_reports (
--   id TEXT PRIMARY KEY,
--   task_id TEXT,
--   staff_id TEXT,
--   started_at TEXT,
--   stopped_at TEXT,
--   notes TEXT,
--   images TEXT
-- );
