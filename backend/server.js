require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('node:crypto');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { prisma, hashPassword, SALT } = require('./models');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security & Performance Middleware ────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Frontend di port berbeda, disable CSP strict
}));
app.use(compression()); // gzip semua response JSON
app.use(cors());
app.use(express.json({ limit: '1mb' })); // Batas ukuran request body

// ─── Rate Limiting (Brute-force protection pada login) ─────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10,                   // Maks 10 percobaan per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi 15 menit kemudian.' },
});

// ─── Token Utilities ───────────────────────────────────────────────────────────
const signToken = (payload) => {
  const data = JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 });
  const sig = crypto.createHmac('sha256', SALT).update(data).digest('hex');
  return Buffer.from(data).toString('base64') + '.' + sig;
};

const verifyToken = (token) => {
  if (!token) return null;
  try {
    const [dataB64, sig] = token.split('.');
    const data = Buffer.from(dataB64, 'base64').toString('utf-8');
    const expected = crypto.createHmac('sha256', SALT).update(data).digest('hex');
    if (sig !== expected) return null;
    const parsed = JSON.parse(data);
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch { return null; }
};

// ─── Auth Middleware ───────────────────────────────────────────────────────────
const authenticate = (req, res, next) => {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir, silakan login ulang.' });
  req.user = user;
  next();
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Akses ditolak. Hanya Administrator yang dapat melakukan tindakan ini.' });
  next();
};

// ─── Response Mappers ──────────────────────────────────────────────────────────
const mapItem = (item) => ({
  id:            item.id,
  category_id:   item.category_id,
  code:          item.code,
  name:          item.name,
  stock:         item.stock,
  min_stock:     item.min_stock,
  unit:          item.unit,
  price:         parseFloat(item.price) || 0,
  created_at:    item.created_at,
  category_name: item.category?.name || null,
});

const formatDate = (d) => d instanceof Date ? d.toISOString().split('T')[0] : d;

const mapTransaction = (t) => ({
  id:            t.id,
  item_id:       t.item_id,
  user_id:       t.user_id,
  type:          t.type,
  quantity:      t.quantity,
  date:          formatDate(t.date),
  notes:         t.notes,
  created_at:    t.created_at,
  item_code:     t.item?.code,
  item_name:     t.item?.name,
  item_unit:     t.item?.unit,
  item_price:    parseFloat(t.item?.price) || 0,
  category_name: t.item?.category?.name,
  operator_name: t.user?.name,
});

// ─── AUTH ──────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', loginLimiter, async (req, res, next) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  try {
    const user = await prisma.user.findUnique({ where: { username: username.trim() } });
    if (!user || user.password !== hashPassword(password)) {
      return res.status(400).json({ error: 'Username atau password salah.' });
    }
    const token = signToken({ id: user.id, username: user.username, name: user.name, role: user.role });
    res.json({
      message: 'Login berhasil',
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    });
  } catch (err) { next(err); }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ─── USERS ─────────────────────────────────────────────────────────────────────
app.get('/api/users', authenticate, adminOnly, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, name: true, role: true, created_at: true },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (err) { next(err); }
});

app.get('/api/users/count', authenticate, async (req, res, next) => {
  try {
    const count = await prisma.user.count();
    res.json({ count });
  } catch (err) { next(err); }
});

app.post('/api/users', authenticate, adminOnly, async (req, res, next) => {
  const { username, password, name, role } = req.body;
  if (!username?.trim() || !password || !name?.trim() || !role) {
    return res.status(400).json({ error: 'Semua field wajib diisi.' });
  }
  try {
    await prisma.user.create({
      data: {
        username: username.trim(),
        password: hashPassword(password),
        name:     name.trim(),
        role,
      },
    });
    res.status(201).json({ message: 'Pengguna berhasil ditambahkan.' });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Username sudah digunakan.' });
    next(err);
  }
});

app.put('/api/users/:id', authenticate, adminOnly, async (req, res, next) => {
  const { username, name, role, password } = req.body;
  if (!username?.trim() || !name?.trim() || !role) {
    return res.status(400).json({ error: 'Username, Nama, dan Role wajib diisi.' });
  }
  try {
    const updateData = { username: username.trim(), name: name.trim(), role };
    if (password) updateData.password = hashPassword(password);
    await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
    });
    res.json({ message: 'Pengguna berhasil diperbarui.' });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Username sudah digunakan.' });
    if (err.code === 'P2025') return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    next(err);
  }
});

app.delete('/api/users/:id', authenticate, adminOnly, async (req, res, next) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Tidak dapat menghapus akun Anda sendiri.' });
  }
  try {
    await prisma.user.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Pengguna berhasil dihapus.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    next(err);
  }
});

// ─── CATEGORIES ────────────────────────────────────────────────────────────────
app.get('/api/categories', authenticate, async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    res.json(categories);
  } catch (err) { next(err); }
});

app.post('/api/categories', authenticate, async (req, res, next) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nama kategori wajib diisi.' });
  try {
    await prisma.category.create({
      data: { name: name.trim(), description: description?.trim() || '' },
    });
    res.status(201).json({ message: 'Kategori berhasil ditambahkan.' });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Nama kategori sudah ada.' });
    next(err);
  }
});

app.put('/api/categories/:id', authenticate, async (req, res, next) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nama kategori wajib diisi.' });
  try {
    await prisma.category.update({
      where: { id: parseInt(req.params.id) },
      data: { name: name.trim(), description: description?.trim() || '' },
    });
    res.json({ message: 'Kategori berhasil diperbarui.' });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Nama kategori sudah ada.' });
    if (err.code === 'P2025') return res.status(404).json({ error: 'Kategori tidak ditemukan.' });
    next(err);
  }
});

app.delete('/api/categories/:id', authenticate, async (req, res, next) => {
  try {
    await prisma.category.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Kategori berhasil dihapus.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Kategori tidak ditemukan.' });
    if (err.code === 'P2003') return res.status(400).json({ error: 'Kategori tidak dapat dihapus karena masih memiliki barang.' });
    next(err);
  }
});

// ─── ITEMS ─────────────────────────────────────────────────────────────────────
app.get('/api/items', authenticate, async (req, res, next) => {
  try {
    const items = await prisma.item.findMany({
      include: { category: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(items.map(mapItem));
  } catch (err) { next(err); }
});

app.post('/api/items', authenticate, async (req, res, next) => {
  const { category_id, code, name, stock, min_stock, unit, price } = req.body;
  if (!category_id || !code?.trim() || !name?.trim() || !unit?.trim()) {
    return res.status(400).json({ error: 'Kategori, Kode, Nama, dan Satuan wajib diisi.' });
  }
  try {
    await prisma.item.create({
      data: {
        category_id: parseInt(category_id),
        code:        code.trim().toUpperCase(),
        name:        name.trim(),
        stock:       parseInt(stock) || 0,
        min_stock:   parseInt(min_stock) || 0,
        unit:        unit.trim(),
        price:       parseFloat(price) || 0,
      },
    });
    res.status(201).json({ message: 'Barang berhasil ditambahkan.' });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Kode barang sudah digunakan.' });
    next(err);
  }
});

app.put('/api/items/:id', authenticate, async (req, res, next) => {
  const { category_id, code, name, min_stock, unit, price } = req.body;
  if (!category_id || !code?.trim() || !name?.trim() || !unit?.trim()) {
    return res.status(400).json({ error: 'Kategori, Kode, Nama, dan Satuan wajib diisi.' });
  }
  try {
    await prisma.item.update({
      where: { id: parseInt(req.params.id) },
      data: {
        category_id: parseInt(category_id),
        code:        code.trim().toUpperCase(),
        name:        name.trim(),
        min_stock:   parseInt(min_stock) || 0,
        unit:        unit.trim(),
        price:       parseFloat(price) || 0,
      },
    });
    res.json({ message: 'Barang berhasil diperbarui.' });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Kode barang sudah digunakan.' });
    if (err.code === 'P2025') return res.status(404).json({ error: 'Barang tidak ditemukan.' });
    next(err);
  }
});

app.delete('/api/items/:id', authenticate, async (req, res, next) => {
  const itemId = parseInt(req.params.id);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { item_id: itemId } });
      await tx.item.delete({ where: { id: itemId } });
    });
    res.json({ message: 'Barang beserta riwayat transaksinya berhasil dihapus.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Barang tidak ditemukan.' });
    next(err);
  }
});

// ─── TRANSACTIONS ──────────────────────────────────────────────────────────────
app.get('/api/transactions', authenticate, async (req, res, next) => {
  try {
    const txs = await prisma.transaction.findMany({
      include: {
        item: { include: { category: { select: { name: true } } } },
        user: { select: { name: true } },
      },
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
    });
    res.json(txs.map(mapTransaction));
  } catch (err) { next(err); }
});

app.post('/api/transactions', authenticate, async (req, res, next) => {
  const { item_id, type, quantity, date, notes } = req.body;
  if (!item_id || !type || !quantity || !date) {
    return res.status(400).json({ error: 'Barang, Tipe, Jumlah, dan Tanggal wajib diisi.' });
  }

  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Jumlah harus lebih dari 0.' });
  if (type !== 'IN' && type !== 'OUT') return res.status(400).json({ error: 'Tipe transaksi tidak valid.' });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Ambil item dengan lock untuk mencegah race condition stok
      const itemIdInt = parseInt(item_id);
      const items = await tx.$queryRaw`
        SELECT id, stock, name FROM items WHERE id = ${itemIdInt} FOR UPDATE
      `;
      const item = items[0];
      if (!item) throw { code: 'NOT_FOUND', message: 'Barang tidak ditemukan.' };

      if (type === 'OUT' && item.stock < qty) {
        throw {
          code: 'INSUFFICIENT_STOCK',
          message: `Stok tidak mencukupi! Stok "${item.name}" saat ini hanya ${item.stock}. Transaksi keluar sebesar ${qty} DITOLAK.`,
        };
      }

      const newStock = type === 'IN' ? item.stock + qty : item.stock - qty;

      await tx.item.update({ where: { id: itemIdInt }, data: { stock: newStock } });
      await tx.transaction.create({
        data: {
          item_id:  itemIdInt,
          user_id:  req.user.id,
          type,
          quantity: qty,
          date:     new Date(date),
          notes:    notes?.trim() || '',
        },
      });
      return newStock;
    });

    res.status(201).json({ message: 'Transaksi berhasil disimpan.', newStock: result });
  } catch (err) {
    if (err.code === 'NOT_FOUND')          return res.status(404).json({ error: err.message });
    if (err.code === 'INSUFFICIENT_STOCK') return res.status(400).json({ error: err.message });
    next(err);
  }
});

// ─── DASHBOARD ─────────────────────────────────────────────────────────────────
app.get('/api/dashboard/stats', authenticate, async (req, res, next) => {
  try {
    // Jalankan semua query ringan secara paralel
    const [itemCount, catCount, txCount, stockValueResult] = await Promise.all([
      prisma.item.count(),
      prisma.category.count(),
      prisma.transaction.count(),
      prisma.$queryRaw`SELECT COALESCE(SUM(stock * price), 0) AS total FROM items`,
    ]);

    const stockValue = parseFloat(stockValueResult[0]?.total) || 0;

    // Barang dengan stok di bawah atau sama dengan minimum (logika baru: Tidak Tersedia + Warning)
    const lowStockAlertsRaw = await prisma.$queryRaw`
      SELECT i.id, i.category_id, i.code, i.name, i.stock, i.min_stock, i.unit,
             CAST(i.price AS CHAR) AS price, i.created_at, c.name AS category_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.stock <= i.min_stock
      ORDER BY i.stock ASC
    `;

    // 5 barang stok terendah & tertinggi – diambil paralel
    const [lowStock, highStock] = await Promise.all([
      prisma.item.findMany({
        select: { name: true, stock: true, min_stock: true },
        orderBy: { stock: 'asc' },
        take: 5,
      }),
      prisma.item.findMany({
        select: { name: true, stock: true },
        orderBy: { stock: 'desc' },
        take: 5,
      }),
    ]);

    res.json({
      counts: { items: itemCount, categories: catCount, transactions: txCount, stockValue },
      lowStockAlerts: lowStockAlertsRaw.map((i) => ({
        id:            Number(i.id),
        category_id:   Number(i.category_id),
        code:          i.code,
        name:          i.name,
        stock:         Number(i.stock),
        min_stock:     Number(i.min_stock),
        unit:          i.unit,
        price:         parseFloat(i.price) || 0,
        created_at:    i.created_at,
        category_name: i.category_name || null,
      })),
      charts: { lowStock, highStock },
    });
  } catch (err) { next(err); }
});

// ─── REPORTS ───────────────────────────────────────────────────────────────────
app.get('/api/reports', authenticate, async (req, res, next) => {
  const { startDate, endDate, type, categoryId } = req.query;
  try {
    const txWhere = {};
    if (startDate && endDate) {
      txWhere.date = { gte: new Date(startDate), lte: new Date(endDate) };
    } else if (startDate) {
      txWhere.date = { gte: new Date(startDate) };
    } else if (endDate) {
      txWhere.date = { lte: new Date(endDate) };
    }
    if (type && type !== 'ALL') txWhere.type = type;

    const catFilter = categoryId ? { category_id: parseInt(categoryId) } : {};

    // Jalankan query transaksi & stok secara paralel
    const [txs, stockItems] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          ...txWhere,
          ...(categoryId ? { item: { is: catFilter } } : {}),
        },
        include: {
          item: { include: { category: { select: { name: true } } } },
          user: { select: { name: true } },
        },
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
      }),
      prisma.item.findMany({
        where: catFilter,
        include: { category: { select: { name: true } } },
        orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
      }),
    ]);

    const transactions = txs.map(mapTransaction);

    let totalQtyIn = 0, totalQtyOut = 0, totalValueIn = 0, totalValueOut = 0;
    for (const t of transactions) {
      if (t.type === 'IN') {
        totalQtyIn  += t.quantity;
        totalValueIn += t.quantity * t.item_price;
      } else {
        totalQtyOut  += t.quantity;
        totalValueOut += t.quantity * t.item_price;
      }
    }

    const stockReport = stockItems.map((i) => ({
      item_code:     i.code,
      item_name:     i.name,
      stock:         i.stock,
      min_stock:     i.min_stock,
      unit:          i.unit,
      price:         parseFloat(i.price) || 0,
      category_name: i.category?.name,
    }));

    res.json({
      transactions,
      summary: { totalQtyIn, totalQtyOut, totalValueIn, totalValueOut, recordCount: transactions.length },
      stockReport,
    });
  } catch (err) { next(err); }
});

// ─── Global Error Handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server: ' + (err.message || 'Unknown error') });
});

// ─── Start Server ──────────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('[DB] ✓ Koneksi MySQL berhasil via Prisma ORM');
    app.listen(PORT, () => {
      console.log(`[SERVER] ✓ PERSIS GUDANG Backend berjalan di http://localhost:${PORT}`);
      console.log(`[SERVER] ✓ API siap diakses dari frontend http://localhost:5173`);
    });
  } catch (err) {
    console.error('[SERVER] ✗ Gagal memulai server:', err.message);
    console.error('[SERVER] Pastikan MySQL berjalan dan DATABASE_URL di .env sudah benar.');
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('\n[SERVER] Server dihentikan, koneksi database ditutup.');
  process.exit(0);
});

startServer();
