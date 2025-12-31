import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(path.dirname(import.meta.url), 'data.sqlite');
const db = new sqlite3.Database(DB_PATH);

// Simple helper to run
function run(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function seed() {
  // create tables - same as backend index init
  const initSql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf-8');
  db.exec(initSql, async (err) => {
    if (err) console.error(err);
    else {
      try {
        // insert example staff
        const staff = [
          {id: uuidv4(), name: 'Manish Kumar', email:'manish@example.com', role:'cleaner', color:'#7C3AED'},
          {id: uuidv4(), name: 'Roxy', email:'roxy@example.com', role:'cleaner', color:'#10B981'}
        ];
        for (const s of staff) {
          await run('INSERT OR IGNORE INTO staff (id,name,email,role,color) VALUES (?,?,?,?,?)', [s.id,s.name,s.email,s.role,s.color]);
        }
        console.log('Seeded.');
        process.exit(0);
      } catch (e) {
        console.error(e);
        process.exit(1);
      }
    }
  });
}
seed();
