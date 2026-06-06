const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');

const dbPath = path.join(__dirname, 'inventory.db');
const db = new DatabaseSync(dbPath);

// Aktifkan foreign key constraints untuk SQLite
db.exec('PRAGMA foreign_keys = ON;');

const SALT = 'persediaan-lsp-salt-2026';

function hashPassword(password) {
  return crypto.scryptSync(password, SALT, 64).toString('hex');
}

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Operator',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      stock INTEGER DEFAULT 0 CHECK(stock >= 0),
      min_stock INTEGER DEFAULT 10,
      unit TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('IN', 'OUT')),
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      date TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE RESTRICT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT
    );
  `);

  // Seed admin if none
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const insertUser = db.prepare('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)');
    insertUser.run('admin', hashPassword('admin123'), 'Administrator', 'Admin');
    insertUser.run('operator', hashPassword('operator123'), 'Operator Staff', 'Operator');
    console.log('[DB] Seeded default users: admin/admin123, operator/operator123');
  }

  // Seed categories if none
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  if (catCount === 0) {
    const insertCat = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
    insertCat.run('Elektronik', 'Perangkat elektronik dan kelistrikan');
    insertCat.run('Alat Tulis Kantor', 'Peralatan menulis dan administrasi');
    insertCat.run('Bahan Baku', 'Bahan baku produksi utama');
    insertCat.run('Aksesoris', 'Peralatan pendukung dan aksesori');
    console.log('[DB] Seeded 4 default categories');
  }
}

initDB();

module.exports = { db, hashPassword, SALT };
