const Database = require('better-sqlite3');
const db = new Database('cdcult.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT UNIQUE,
    email TEXT UNIQUE,
    name TEXT,
    password TEXT,
    role TEXT DEFAULT 'artist',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS releases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT, subtitle TEXT, release_type TEXT, artists TEXT, genre TEXT,
    status TEXT DEFAULT 'draft', cover_url TEXT, archive_url TEXT,
    metadata TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS upc_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    release_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    artist_name TEXT,
    release_title TEXT,
    status TEXT DEFAULT 'pending',
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    upc_code TEXT,
    FOREIGN KEY(release_id) REFERENCES releases(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

const ensureColumn = (table, column, definition) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
};

ensureColumn('users', 'telegram', 'TEXT DEFAULT \'\'');
ensureColumn('users', 'avatar', 'TEXT DEFAULT \'\'');

module.exports = db;
