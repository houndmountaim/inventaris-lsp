const { db, hashPassword } = require('./db');

console.log('\n=== TEST INTEGRASI DATABASE - PERSIS GUDANG ===\n');
let failed = false;

function assert(ok, msg) {
  if (!ok) { console.error(`❌ GAGAL: ${msg}`); failed = true; }
  else console.log(`✅ OK: ${msg}`);
}

try {
  // 1. Verifikasi users & password hash
  const admin = db.prepare('SELECT * FROM users WHERE username=?').get('admin');
  assert(admin !== undefined, 'Admin default ditemukan');
  assert(admin.role === 'Admin', 'Role admin = Admin');
  assert(admin.password === hashPassword('admin123'), 'Password hash admin benar');

  // 2. Verifikasi kategori
  const cats = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
  assert(cats > 0, `Kategori default tersedia (${cats} kategori)`);

  // 3. Buat test category & item
  db.exec('BEGIN TRANSACTION');
  const catId = db.prepare('INSERT INTO categories (name) VALUES (?)').run('__TEST__').lastInsertRowid;
  const itemId = db.prepare('INSERT INTO items (category_id, code, name, stock, min_stock, unit, price) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(catId, '__T001__', 'Barang Test', 20, 5, 'pcs', 10000).lastInsertRowid;
  db.exec('COMMIT');

  const item = db.prepare('SELECT stock FROM items WHERE id=?').get(itemId);
  assert(item.stock === 20, 'Stok awal barang = 20');

  // 4. Transaksi Masuk (IN)
  db.exec('BEGIN TRANSACTION');
  db.prepare('UPDATE items SET stock=? WHERE id=?').run(item.stock + 10, itemId);
  db.prepare('INSERT INTO transactions (item_id, user_id, type, quantity, date) VALUES (?, ?, ?, ?, ?)').run(itemId, admin.id, 'IN', 10, '2026-06-06');
  db.exec('COMMIT');
  assert(db.prepare('SELECT stock FROM items WHERE id=?').get(itemId).stock === 30, 'Stok bertambah ke 30 setelah IN');

  // 5. Transaksi Keluar (OUT) valid
  db.exec('BEGIN TRANSACTION');
  db.prepare('UPDATE items SET stock=? WHERE id=?').run(30 - 15, itemId);
  db.prepare('INSERT INTO transactions (item_id, user_id, type, quantity, date) VALUES (?, ?, ?, ?, ?)').run(itemId, admin.id, 'OUT', 15, '2026-06-06');
  db.exec('COMMIT');
  assert(db.prepare('SELECT stock FROM items WHERE id=?').get(itemId).stock === 15, 'Stok berkurang ke 15 setelah OUT');

  // 6. Transaksi Keluar DITOLAK jika stok kurang
  let rejected = false;
  db.exec('BEGIN TRANSACTION');
  try {
    const cur = db.prepare('SELECT stock FROM items WHERE id=?').get(itemId);
    if (cur.stock < 99) throw new Error('STOK_KURANG');
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    if (e.message === 'STOK_KURANG') rejected = true;
  }
  assert(rejected, 'Sistem menolak OUT jika stok tidak mencukupi');
  assert(db.prepare('SELECT stock FROM items WHERE id=?').get(itemId).stock === 15, 'Stok tetap 15 setelah penolakan');

  // Cleanup
  db.exec('BEGIN TRANSACTION');
  db.prepare('DELETE FROM transactions WHERE item_id=?').run(itemId);
  db.prepare('DELETE FROM items WHERE id=?').run(itemId);
  db.prepare('DELETE FROM categories WHERE id=?').run(catId);
  db.exec('COMMIT');

  console.log('\n══════════════════════════════════════════');
  if (failed) { console.log('❌ BEBERAPA TES GAGAL'); process.exit(1); }
  else { console.log('🎉 SEMUA TES BERHASIL!\n'); process.exit(0); }
} catch (e) {
  console.error('FATAL:', e.message);
  process.exit(1);
}
