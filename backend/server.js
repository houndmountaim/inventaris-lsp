require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('node:crypto');
const { prisma, hashPassword, SALT } = require('./models');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

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
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || user.password !== hashPassword(password)) {
      return res.status(400).json({ error: 'Username atau password salah.' });
    }
    const token = signToken({ id: user.id, username: user.username, name: user.name, role: user.role });
    res.json({
      message: 'Login berhasil',
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: 'Kesalahan server: ' + err.message });
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ─── USERS ─────────────────────────────────────────────────────────────────────
app.get('/api/users', authenticate, adminOnly, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, name: true, role: true, created_at: true },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users/count', authenticate, async (req, res) => {
  try {
    const count = await prisma.user.count();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', authenticate, adminOnly, async (req, res) => {
  const { username, password, name, role } = req.body;
  if (!username || !password || !name || !role) return res.status(400).json({ error: 'Semua field wajib diisi.' });
  try {
    await prisma.user.create({
      data: {
        username: username.trim(),
        password: hashPassword(password),
        name: name.trim(),
        role,
      },
    });
    res.status(201).json({ message: 'Pengguna berhasil ditambahkan.' });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Username sudah digunakan.' });
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', authenticate, adminOnly, async (req, res) => {
  const { username, name, role, password } = req.body;
  if (!username || !name || !role) return res.status(400).json({ error: 'Username, Nama, dan Role wajib diisi.' });
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
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', authenticate, adminOnly, async (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Tidak dapat menghapus akun Anda sendiri.' });
  try {
    await prisma.user.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Pengguna berhasil dihapus.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    res.status(500).json({ error: err.message });
  }
});

// ─── CATEGORIES ────────────────────────────────────────────────────────────────
app.get('/api/categories', authenticate, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    res.json(categories);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/categories', authenticate, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Nama kategori wajib diisi.' });
  try {
    await prisma.category.create({
      data: { name: name.trim(), description: description || '' },
    });
    res.status(201).json({ message: 'Kategori berhasil ditambahkan.' });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Nama kategori sudah ada.' });
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/categories/:id', authenticate, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Nama kategori wajib diisi.' });
  try {
    await prisma.category.update({
      where: { id: parseInt(req.params.id) },
      data: { name: name.trim(), description: description || '' },
    });
    res.json({ message: 'Kategori berhasil diperbarui.' });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Nama kategori sudah ada.' });
    if (err.code === 'P2025') return res.status(404).json({ error: 'Kategori tidak ditemukan.' });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', authenticate, async (req, res) => {
  try {
    await prisma.category.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Kategori berhasil dihapus.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Kategori tidak ditemukan.' });
    if (err.code === 'P2003') return res.status(400).json({ error: 'Kategori tidak dapat dihapus karena masih memiliki barang.' });
    res.status(500).json({ error: err.message });
  }
});

// ─── ITEMS ─────────────────────────────────────────────────────────────────────
app.get('/api/items', authenticate, async (req, res) => {
  try {
    const items = await prisma.item.findMany({
      include: { category: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(items.map(mapItem));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/items', authenticate, async (req, res) => {
  const { category_id, code, name, stock, min_stock, unit, price } = req.body;
  if (!category_id || !code || !name || !unit) return res.status(400).json({ error: 'Kategori, Kode, Nama, dan Satuan wajib diisi.' });
  try {
    await prisma.item.create({
      data: {
        category_id: parseInt(category_id),
        code:        code.trim(),
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
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/items/:id', authenticate, async (req, res) => {
  const { category_id, code, name, min_stock, unit, price } = req.body;
  if (!category_id || !code || !name || !unit) return res.status(400).json({ error: 'Kategori, Kode, Nama, dan Satuan wajib diisi.' });
  try {
    await prisma.item.update({
      where: { id: parseInt(req.params.id) },
      data: {
        category_id: parseInt(category_id),
        code:        code.trim(),
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
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/items/:id', authenticate, async (req, res) => {
  const itemId = parseInt(req.params.id);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { item_id: itemId } });
      await tx.item.delete({ where: { id: itemId } });
    });
    res.json({ message: 'Barang beserta riwayat transaksinya berhasil dihapus.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Barang tidak ditemukan.' });
    res.status(500).json({ error: err.message });
  }
});

// ─── TRANSACTIONS ──────────────────────────────────────────────────────────────
app.get('/api/transactions', authenticate, async (req, res) => {
  try {
    const txs = await prisma.transaction.findMany({
      include: {
        item: {
          include: { category: { select: { name: true } } },
        },
        user: { select: { name: true } },
      },
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
    });
    res.json(txs.map(mapTransaction));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/transactions', authenticate, async (req, res) => {
  const { item_id, type, quantity, date, notes } = req.body;
  if (!item_id || !type || !quantity || !date) return res.status(400).json({ error: 'Barang, Tipe, Jumlah, dan Tanggal wajib diisi.' });

  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Jumlah harus lebih dari 0.' });
  if (type !== 'IN' && type !== 'OUT') return res.status(400).json({ error: 'Tipe transaksi tidak valid.' });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Ambil item dengan lock (untuk keamanan stok)
      const item = await tx.item.findUnique({ where: { id: parseInt(item_id) } });
      if (!item) throw { code: 'NOT_FOUND', message: 'Barang tidak ditemukan.' };

      if (type === 'OUT' && item.stock < qty) {
        throw {
          code: 'INSUFFICIENT_STOCK',
          message: `Stok tidak mencukupi! Stok "${item.name}" saat ini hanya ${item.stock}. Transaksi keluar sebesar ${qty} DITOLAK.`,
        };
      }

      const newStock = type === 'IN' ? item.stock + qty : item.stock - qty;

      await tx.item.update({
        where: { id: parseInt(item_id) },
        data: { stock: newStock },
      });

      await tx.transaction.create({
        data: {
          item_id:  parseInt(item_id),
          user_id:  req.user.id,
          type,
          quantity: qty,
          date:     new Date(date),
          notes:    notes || '',
        },
      });

      return newStock;
    });

    res.status(201).json({ message: 'Transaksi berhasil disimpan.', newStock: result });
  } catch (err) {
    if (err.code === 'NOT_FOUND')          return res.status(404).json({ error: err.message });
    if (err.code === 'INSUFFICIENT_STOCK') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Transaksi gagal: ' + err.message });
  }
});

// ─── DASHBOARD ─────────────────────────────────────────────────────────────────
app.get('/api/dashboard/stats', authenticate, async (req, res) => {
  try {
    const [itemCount, catCount, txCount] = await Promise.all([
      prisma.item.count(),
      prisma.category.count(),
      prisma.transaction.count(),
    ]);

    // Nilai total stok = SUM(stock * price)
    const stockValueResult = await prisma.$queryRaw`
      SELECT COALESCE(SUM(stock * price), 0) AS total FROM items
    `;
    const stockValue = parseFloat(stockValueResult[0]?.total) || 0;

    // Barang dengan stok di bawah minimum (perbandingan 2 kolom → harus raw query)
    const lowStockAlertsRaw = await prisma.$queryRaw`
      SELECT i.id, i.category_id, i.code, i.name, i.stock, i.min_stock, i.unit,
             CAST(i.price AS CHAR) AS price, i.created_at, c.name AS category_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.stock < i.min_stock
      ORDER BY i.stock ASC
    `;

    // 5 barang stok terendah
    const lowStock = await prisma.item.findMany({
      select: { name: true, stock: true },
      orderBy: { stock: 'asc' },
      take: 5,
    });

    // 5 barang stok tertinggi
    const highStock = await prisma.item.findMany({
      select: { name: true, stock: true },
      orderBy: { stock: 'desc' },
      take: 5,
    });

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
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ─── REPORTS ───────────────────────────────────────────────────────────────────
app.get('/api/reports', authenticate, async (req, res) => {
  const { startDate, endDate, type, categoryId } = req.query;
  try {
    // Build filter transaksi
    const txWhere = {};
    if (startDate && endDate) {
      txWhere.date = { gte: new Date(startDate), lte: new Date(endDate) };
    } else if (startDate) {
      txWhere.date = { gte: new Date(startDate) };
    } else if (endDate) {
      txWhere.date = { lte: new Date(endDate) };
    }
    if (type && type !== 'ALL') txWhere.type = type;

    // Filter barang berdasarkan kategori
    const itemWhere = {};
    if (categoryId) itemWhere.category_id = parseInt(categoryId);

    const txs = await prisma.transaction.findMany({
      where: {
        ...txWhere,
        ...(categoryId ? { item: { is: { category_id: parseInt(categoryId) } } } : {}),
      },
      include: {
        item: {
          include: { category: { select: { name: true } } },
        },
        user: { select: { name: true } },
      },
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
    });

    const transactions = txs.map(mapTransaction);

    let totalQtyIn = 0, totalQtyOut = 0, totalValueIn = 0, totalValueOut = 0;
    transactions.forEach((t) => {
      if (t.type === 'IN') {
        totalQtyIn  += t.quantity;
        totalValueIn += t.quantity * t.item_price;
      } else {
        totalQtyOut  += t.quantity;
        totalValueOut += t.quantity * t.item_price;
      }
    });

    // Stock report (semua barang dengan filter kategori jika ada)
    const stockItems = await prisma.item.findMany({
      where: categoryId ? { category_id: parseInt(categoryId) } : {},
      include: { category: { select: { name: true } } },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    });

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
  } catch (err) { res.status(500).json({ error: err.message }); }
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
