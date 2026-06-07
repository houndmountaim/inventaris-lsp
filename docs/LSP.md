# Dokumentasi LSP — Web Programmer
**Nama:** Petrus Handika  
**Kelas:** 4KA24  
**NPM:** 11122114  
**Proyek:** PERSIS GUDANG — Sistem Inventaris LSP

---

## Sesi 1

### 1. Menentukan Kebutuhan Software

Berikut adalah daftar tools dan software yang digunakan dalam pengembangan proyek ini:

| Kategori | Tools / Software |
|---|---|
| **IDE** | Trae AI |
| **Runtime** | Node.js |
| **Framework Backend** | Express.js |
| **Framework Frontend** | React.js (Vite) |
| **ORM** | Prisma ORM |
| **Database** | MySQL |
| **GUI Database** | Navicat / phpMyAdmin |
| **Package Manager** | npm |
| **Version Control** | Git / GitHub |
| **Terminal** | Warp |
| **Browser** | Google Chrome |
| **Design** | Figma |
| **Rancangan** | Lucidchart |

---

### 2. Membuat Struktur Navigasi

Aplikasi PERSIS GUDANG memiliki dua jenis pengguna: **Admin** dan **Operator**. Berikut struktur navigasi lengkapnya:

```mermaid
flowchart TD
    A([Buka Aplikasi]) --> B{Sudah Login?}
    B -- Tidak --> C[Halaman Login]
    C --> D{Autentikasi}
    D -- Gagal --> C
    D -- Berhasil --> E{Role Pengguna?}

    E -- Admin --> F[Dashboard]
    E -- Operator --> F

    F --> G[Kategori Barang]
    F --> H[Daftar Barang]
    F --> I[Transaksi Stok]
    F --> J[Laporan]
    F --> K{Admin Only}
    K -- Ya --> L[Kelola Pengguna]
    K -- Tidak --> M([Akses Ditolak])

    G --> G1[Tambah Kategori]
    G --> G2[Edit Kategori]
    G --> G3[Hapus Kategori]

    H --> H1[Tambah Barang]
    H --> H2[Edit Barang]
    H --> H3[Hapus Barang]

    I --> I1[Transaksi Masuk IN]
    I --> I2[Transaksi Keluar OUT]

    J --> J1[Filter Laporan]
    J --> J2[Rekap Mutasi Stok]
    J --> J3[Laporan Stok Barang]

    L --> L1[Tambah Pengguna]
    L --> L2[Edit Pengguna]
    L --> L3[Hapus Pengguna]

    style A fill:#4f46e5,color:#fff
    style C fill:#0ea5e9,color:#fff
    style F fill:#10b981,color:#fff
    style M fill:#ef4444,color:#fff
    style K fill:#f59e0b,color:#fff
```

#### Ringkasan Halaman per Role

| Halaman | Operator | Admin |
|---|:---:|:---:|
| Dashboard | ✅ | ✅ |
| Kategori Barang | ✅ | ✅ |
| Daftar Barang | ✅ | ✅ |
| Transaksi Stok | ✅ | ✅ |
| Laporan | ✅ | ✅ |
| Kelola Pengguna | ❌ | ✅ |

---

### 3. Membuat Rancangan Tampilan

Rancangan tampilan menggunakan pendekatan **Single Page Application (SPA)** dengan layout sidebar tetap di kiri dan konten utama di kanan.

#### Layout Umum

```mermaid
graph LR
    subgraph Aplikasi["Layout Utama"]
        direction LR
        SB["🗂 Sidebar\n─────────\nLogo & Nama\nMenu Navigasi\nInfo Pengguna\nTombol Logout"]
        MAIN["📄 Konten Utama\n─────────────────\nTopbar (Judul + Badge Role)\nArea Konten Halaman"]
    end
    SB --> MAIN
```

#### Daftar Halaman

| Halaman | Route | Deskripsi |
|---|---|---|
| Login | `/` (unauthenticated) | Form autentikasi pengguna |
| Dashboard | `/` | Statistik, grafik stok, dan alert stok rendah |
| Kategori Barang | `/categories` | CRUD kategori barang |
| Daftar Barang | `/items` | CRUD data barang inventaris |
| Transaksi Stok | `/transactions` | Input transaksi masuk (IN) dan keluar (OUT) |
| Laporan | `/reports` | Laporan mutasi dengan filter tanggal, tipe, dan kategori |
| Kelola Pengguna | `/users` | CRUD akun pengguna (Admin only) |

---

## Sesi 2

### 1. Membuat Struktur Tabel

Database yang digunakan: **`inventory_db`** (MySQL)

Dikelola menggunakan **Prisma ORM** dengan schema terdefinisi di `backend/prisma/schema.prisma`.

#### Tabel: `users`

| Field | Tipe | Null | Keterangan |
|---|---|:---:|---|
| `id` | INT | No | Primary Key, auto increment |
| `username` | VARCHAR(100) | No | Unique, untuk login |
| `password` | VARCHAR(255) | No | Hasil hash scrypt |
| `name` | VARCHAR(255) | No | Nama lengkap |
| `role` | VARCHAR(20) | No | Default: `Operator`; nilai: `Admin` / `Operator` |
| `created_at` | DATETIME | No | Waktu dibuat, default now() |

#### Tabel: `categories`

| Field | Tipe | Null | Keterangan |
|---|---|:---:|---|
| `id` | INT | No | Primary Key, auto increment |
| `name` | VARCHAR(255) | No | Unique, nama kategori |
| `description` | TEXT | Yes | Deskripsi kategori |
| `created_at` | DATETIME | No | Waktu dibuat, default now() |

#### Tabel: `items`

| Field | Tipe | Null | Keterangan |
|---|---|:---:|---|
| `id` | INT | No | Primary Key, auto increment |
| `category_id` | INT | No | Foreign Key → `categories.id` |
| `code` | VARCHAR(100) | No | Unique, kode barang |
| `name` | VARCHAR(255) | No | Nama barang |
| `stock` | INT | No | Stok saat ini, default 0 |
| `min_stock` | INT | No | Batas minimum stok, default 10 |
| `unit` | VARCHAR(50) | No | Satuan (pcs, kg, liter, dll) |
| `price` | DECIMAL(15,2) | No | Harga satuan, default 0.00 |
| `created_at` | DATETIME | No | Waktu dibuat, default now() |

#### Tabel: `transactions`

| Field | Tipe | Null | Keterangan |
|---|---|:---:|---|
| `id` | INT | No | Primary Key, auto increment |
| `item_id` | INT | No | Foreign Key → `items.id` |
| `user_id` | INT | No | Foreign Key → `users.id` |
| `type` | VARCHAR(10) | No | Nilai: `IN` (masuk) / `OUT` (keluar) |
| `quantity` | INT | No | Jumlah barang transaksi |
| `date` | DATE | No | Tanggal transaksi |
| `notes` | TEXT | Yes | Keterangan tambahan |
| `created_at` | DATETIME | No | Waktu dicatat, default now() |

---

### 2. Implementasi Database

#### Diagram Relasi Antar Tabel

```mermaid
erDiagram
    users {
        int id PK
        varchar username
        varchar password
        varchar name
        varchar role
        datetime created_at
    }

    categories {
        int id PK
        varchar name
        text description
        datetime created_at
    }

    items {
        int id PK
        int category_id FK
        varchar code
        varchar name
        int stock
        int min_stock
        varchar unit
        decimal price
        datetime created_at
    }

    transactions {
        int id PK
        int item_id FK
        int user_id FK
        varchar type
        int quantity
        date date
        text notes
        datetime created_at
    }

    categories ||--o{ items : "memiliki"
    items ||--o{ transactions : "dicatat di"
    users ||--o{ transactions : "dilakukan oleh"
```

#### Migrasi & Seeding Database

```bash
# 1. Jalankan migrasi untuk membuat tabel di database
npm run prisma:migrate

# 2. Isi data awal (users default & kategori)
npm run db:seed
```

**Data default dari seeding:**

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Admin |
| `operator` | `operator123` | Operator |

**Kategori default:**
- Elektronik
- Alat Tulis Kantor
- Bahan Baku
- Aksesoris

---

## Sesi 3

### 1. Membuat Koneksi Database

Koneksi database dikonfigurasi melalui file `.env` di folder `backend/`:

```env
PORT=5000
DATABASE_URL="mysql://root:password@localhost:3306/inventory_db"
SALT=persediaan-lsp-salt-2026
```

Koneksi dikelola oleh **Prisma Client** yang diinisialisasi di `backend/models/index.js` dan dipanggil di `server.js`:

```js
// backend/server.js
const { prisma, hashPassword, SALT } = require('./models');

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('[DB] ✓ Koneksi MySQL berhasil via Prisma ORM');
    app.listen(PORT, () => {
      console.log(`[SERVER] ✓ Backend berjalan di http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[SERVER] ✗ Gagal memulai server:', err.message);
    process.exit(1);
  }
};
```

#### Alur Autentikasi (Token-Based)

```mermaid
sequenceDiagram
    participant FE as Frontend (React)
    participant BE as Backend (Express)
    participant DB as Database (MySQL)

    FE->>BE: POST /api/auth/login { username, password }
    BE->>DB: SELECT * FROM users WHERE username = ?
    DB-->>BE: Data pengguna
    BE->>BE: Verifikasi password (scrypt hash)
    BE-->>FE: { token, user: { id, name, role } }
    
    Note over FE: Token disimpan di localStorage

    FE->>BE: GET /api/... (Authorization: Bearer <token>)
    BE->>BE: Verifikasi token (HMAC-SHA256)
    BE-->>FE: Data yang diminta
```

---

### 2. Implementasi Pembuatan Website

#### Struktur Proyek

```
inventaris-lsp/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # Definisi tabel & relasi
│   │   └── seed.js           # Data awal database
│   ├── models/
│   │   └── index.js          # Prisma Client & helper
│   ├── server.js             # Entry point + semua route API
│   ├── .env                  # Konfigurasi environment
│   └── package.json
│
├── frontend/
│   └── src/
│       ├── views/
│       │   ├── Login.jsx         # Halaman login
│       │   ├── Dashboard.jsx     # Halaman utama & statistik
│       │   ├── Categories.jsx    # Manajemen kategori
│       │   ├── Items.jsx         # Manajemen barang
│       │   ├── Transactions.jsx  # Input transaksi stok
│       │   ├── Reports.jsx       # Laporan & filter
│       │   └── Users.jsx         # Manajemen pengguna (Admin)
│       ├── components/           # Komponen UI reusable
│       ├── utils/
│       │   └── api.js            # Helper axios/fetch
│       ├── App.jsx               # Router & layout utama
│       └── main.jsx              # Entry point React
│
└── docs/
    └── LSP.md                    # Dokumentasi ini
```

#### Daftar API Endpoint

```mermaid
graph TD
    subgraph AUTH["🔐 Auth"]
        A1["POST /api/auth/login"]
        A2["GET /api/auth/me"]
    end

    subgraph USERS["👥 Users (Admin Only)"]
        U1["GET /api/users"]
        U2["POST /api/users"]
        U3["PUT /api/users/:id"]
        U4["DELETE /api/users/:id"]
    end

    subgraph CATEGORIES["🏷 Categories"]
        C1["GET /api/categories"]
        C2["POST /api/categories"]
        C3["PUT /api/categories/:id"]
        C4["DELETE /api/categories/:id"]
    end

    subgraph ITEMS["📦 Items"]
        I1["GET /api/items"]
        I2["POST /api/items"]
        I3["PUT /api/items/:id"]
        I4["DELETE /api/items/:id"]
    end

    subgraph TRANSACTIONS["🔄 Transactions"]
        T1["GET /api/transactions"]
        T2["POST /api/transactions"]
    end

    subgraph REPORTS["📊 Reports & Dashboard"]
        R1["GET /api/dashboard/stats"]
        R2["GET /api/reports"]
    end
```

#### Cara Menjalankan Aplikasi

```bash
# ── Backend ──────────────────────────────────────
cd backend
npm install

# Salin dan isi file environment
cp .env.example .env

# Jalankan migrasi database
npm run prisma:migrate

# Isi data awal
npm run db:seed

# Jalankan server development
npm run dev
# Server berjalan di: http://localhost:5000

# ── Frontend ─────────────────────────────────────
cd frontend
npm install

# Jalankan frontend development
npm run dev
# Aplikasi berjalan di: http://localhost:5173
```

#### Fitur Keamanan

| Fitur | Implementasi |
|---|---|
| **Hash Password** | `crypto.scryptSync` + SALT dari `.env` |
| **Token Auth** | Custom HMAC-SHA256 token (expire 24 jam) |
| **Role Guard** | Middleware `adminOnly` di endpoint sensitif |
| **Race Condition Stok** | Prisma transaction + `SELECT ... FOR UPDATE` |
| **Validasi Input** | Validasi manual di setiap route handler |

---

> 📌 **Catatan:** Dokumentasi ini dibuat berdasarkan implementasi aktual proyek `inventaris-lsp` dengan stack **Node.js + Express + Prisma + MySQL + React (Vite)**.
