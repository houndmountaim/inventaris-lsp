import React, { useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';
import ConfirmDialog from '../components/ConfirmDialog';

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

export default function Items({ addToast }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ code: '', name: '', category_id: '', stock: '0', min_stock: '10', unit: 'pcs', price: '0' });
  const [modalError, setModalError] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [userCount, setUserCount] = useState(5);
  const [alertOpen, setAlertOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [i, c, uc] = await Promise.all([
        apiRequest('/api/items'),
        apiRequest('/api/categories'),
        apiRequest('/api/users/count').catch(() => ({ count: 5 }))
      ]);
      setItems(i);
      setCategories(c);
      setUserCount(uc.count);
    } catch (e) { addToast(e.message, 'danger'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openAddModal = () => {
    if (userCount < 5) {
      setAlertOpen(true);
      return;
    }
    setEditingItem(null);
    setFormData({ code: '', name: '', category_id: String(categories[0]?.id || ''), stock: '0', min_stock: '10', unit: 'pcs', price: '0' });
    setModalError('');
    setErrors({});
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({ code: item.code, name: item.name, category_id: String(item.category_id), stock: String(item.stock), min_stock: String(item.min_stock), unit: item.unit, price: String(item.price) });
    setModalError('');
    setErrors({});
    setModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(p => { const copy = { ...p }; delete copy[name]; return copy; });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingItem && userCount < 5) {
      setAlertOpen(true);
      return;
    }
    const { code, name, category_id, stock, min_stock, unit, price } = formData;

    const newErrors = {};
    if (!code.trim()) {
      newErrors.code = 'Kode barang wajib diisi';
    } else if (/\s/g.test(code.trim())) {
      newErrors.code = 'Kode barang tidak boleh mengandung spasi';
    } else if (code.trim().length > 20) {
      newErrors.code = 'Kode barang maksimal 20 karakter';
    }

    if (!name.trim()) {
      newErrors.name = 'Nama barang wajib diisi';
    } else if (name.trim().length > 100) {
      newErrors.name = 'Nama barang maksimal 100 karakter';
    }

    if (!category_id) {
      newErrors.category_id = 'Kategori wajib dipilih';
    }

    if (!unit.trim()) {
      newErrors.unit = 'Satuan wajib diisi';
    } else if (unit.trim().length > 20) {
      newErrors.unit = 'Satuan maksimal 20 karakter';
    }

    const priceNum = parseFloat(price);
    if (price === '' || isNaN(priceNum) || priceNum < 0) {
      newErrors.price = 'Harga harus berupa angka dan minimal 0';
    }

    const minStockNum = parseInt(min_stock);
    if (min_stock === '' || isNaN(minStockNum) || minStockNum < 0) {
      newErrors.min_stock = 'Stok minimum harus berupa angka dan minimal 0';
    }

    if (!editingItem) {
      const stockNum = parseInt(stock);
      if (stock === '' || isNaN(stockNum) || stockNum < 0) {
        newErrors.stock = 'Stok awal harus berupa angka dan minimal 0';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setModalError('Mohon perbaiki kesalahan input di bawah.');
      return;
    }

    setSubmitting(true); setModalError(''); setErrors({});
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        category_id: parseInt(category_id),
        stock: !editingItem ? (parseInt(stock) || 0) : undefined,
        min_stock: parseInt(min_stock) || 0,
        unit: unit.trim(),
        price: parseFloat(price) || 0
      };
      if (editingItem) {
        await apiRequest(`/api/items/${editingItem.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        addToast('Barang berhasil diperbarui', 'success');
      } else {
        await apiRequest('/api/items', { method: 'POST', body: JSON.stringify(payload) });
        addToast('Barang berhasil ditambahkan', 'success');
      }
      setModalOpen(false); fetchData();
    } catch (e) { setModalError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await apiRequest(`/api/items/${confirmDelete.id}`, { method: 'DELETE' });
      addToast('Barang berhasil dihapus', 'success');
      fetchData();
    } catch (e) { addToast(e.message, 'danger'); }
    finally { setConfirmDelete(null); }
  };

  const filtered = items.filter(item => {
    const s = (item.name + item.code).toLowerCase().includes(search.toLowerCase());
    const c = !selectedCategory || String(item.category_id) === String(selectedCategory);
    return s && c;
  });

  return (
    <div>
      <div className="filter-bar">
        <div className="filter-inputs">
          <input
            type="text" className="form-control" placeholder="Cari kode atau nama..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: '230px' }}
          />
          <select
            className="form-control" value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            style={{ maxWidth: '190px' }}
          >
            <option value="">Semua Kategori</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
            {filtered.length} barang
          </span>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '17px', height: '17px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Tambah Barang
        </button>
      </div>

      {/* ── Banner Peringatan Stok ──────────────────────────────────────── */}
      {(() => {
        const habis   = items.filter(i => i.stock === 0);
        const tipis   = items.filter(i => i.stock > 0 && i.stock < i.min_stock);
        const lt10    = items.filter(i => i.stock > 0 && i.stock < 10 && i.stock >= i.min_stock);
        if (habis.length === 0 && tipis.length === 0 && lt10.length === 0) return null;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
            {habis.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 'var(--radius-md)', padding: '10px 16px', flex: '1', minWidth: '200px',
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="var(--danger)" style={{ width: '20px', height: '20px', flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--danger)' }}>
                    {habis.length} Barang Stok Habis
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
                    {habis.slice(0, 3).map(i => i.name).join(', ')}{habis.length > 3 ? ` +${habis.length - 3} lainnya` : ''}
                  </div>
                </div>
              </div>
            )}
            {tipis.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 'var(--radius-md)', padding: '10px 16px', flex: '1', minWidth: '200px',
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="var(--warning)" style={{ width: '20px', height: '20px', flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--warning)' }}>
                    {tipis.length} Barang Stok Tipis (di bawah minimum)
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
                    {tipis.slice(0, 3).map(i => i.name).join(', ')}{tipis.length > 3 ? ` +${tipis.length - 3} lainnya` : ''}
                  </div>
                </div>
              </div>
            )}
            {lt10.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
                borderRadius: 'var(--radius-md)', padding: '10px 16px', flex: '1', minWidth: '200px',
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="var(--warning)" style={{ width: '20px', height: '20px', flexShrink: 0, opacity: 0.7 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.083.87l-.512 1.902a.75.75 0 00.954.91l.04-.017M12 6.75h.008v.008H12V6.75zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--warning)', opacity: 0.8 }}>
                    {lt10.length} Barang Stok &lt; 10
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
                    Perlu diperhatikan sebelum habis
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <div className="card">
        {loading ? (
          <div>
            {[0,1,2,3,4].map(i => (
              <div key={i} className="skeleton-row">
                <span className="skeleton" style={{ width: '80px', height: '14px' }} />
                <span className="skeleton" style={{ flex: 1, height: '14px' }} />
                <span className="skeleton" style={{ width: '80px', height: '14px' }} />
                <span className="skeleton" style={{ width: '60px', height: '14px' }} />
                <span className="skeleton" style={{ width: '90px', height: '24px', borderRadius: '9999px' }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            <p>{search || selectedCategory ? 'Tidak ada barang yang cocok dengan filter.' : 'Belum ada barang. Tambah barang pertama Anda.'}</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th><th>Nama Barang</th><th>Kategori</th><th>Satuan</th>
                  <th style={{ textAlign: 'right' }}>Harga</th>
                  <th style={{ textAlign: 'right' }}>Stok</th>
                  <th style={{ textAlign: 'right' }}>Min</th>
                  <th>Status</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const isHabis  = item.stock === 0;
                  const isTipis  = !isHabis && item.stock < item.min_stock;
                  const isLt10   = !isHabis && !isTipis && item.stock < 10;
                  const isAman   = !isHabis && !isTipis && !isLt10;

                  // Warna baris
                  const rowBg = isHabis
                    ? 'rgba(239,68,68,0.05)'
                    : isTipis
                    ? 'rgba(245,158,11,0.05)'
                    : isLt10
                    ? 'rgba(245,158,11,0.025)'
                    : 'transparent';

                  // Warna angka stok
                  const stockColor = isHabis ? 'var(--danger)'
                    : isTipis || isLt10 ? 'var(--warning)'
                    : 'var(--text-primary)';

                  // Badge status
                  const badge = isHabis
                    ? <span className="badge badge-pulse-danger">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '11px', height: '11px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        Habis
                      </span>
                    : isTipis
                    ? <span className="badge badge-pulse-warning">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '11px', height: '11px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                        Tipis
                      </span>
                    : isLt10
                    ? <span className="badge badge-warning">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '11px', height: '11px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                        &lt; 10
                      </span>
                    : <span className="badge badge-success">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '11px', height: '11px' }}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        Aman
                      </span>;

                  return (
                    <tr key={item.id} style={{ backgroundColor: rowBg }}>
                      <td><code style={{ fontSize: '0.82rem', color: 'var(--accent-color)' }}>{item.code}</code></td>
                      <td style={{ fontWeight: '600' }}>
                        {item.name}
                        {(isHabis || isTipis || isLt10) && (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke={isHabis ? 'var(--danger)' : 'var(--warning)'} style={{ width: '14px', height: '14px', marginLeft: '6px', verticalAlign: 'middle', flexShrink: 0 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                          </svg>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{item.category_name || '—'}</td>
                      <td>{item.unit}</td>
                      <td style={{ textAlign: 'right' }}>{formatRupiah(item.price)}</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: stockColor, fontSize: '0.9rem' }}>
                        {item.stock}
                        {isLt10 && !isTipis && (
                          <span style={{ fontSize: '0.7rem', marginLeft: '4px', opacity: 0.7, fontWeight: '500' }}>⚠</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{item.min_stock}</td>
                      <td>{badge}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(item)}>Ubah</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(item)}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>{editingItem ? 'Ubah Data Barang' : 'Tambah Barang Baru'}</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {modalError && <div className="alert alert-danger">{modalError}</div>}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Kode Barang <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="text" name="code" className={`form-control ${errors.code ? 'is-invalid' : ''}`} placeholder="Contoh: BRG-001" value={formData.code} onChange={handleInputChange} disabled={submitting} autoFocus />
                    {errors.code && <div className="invalid-feedback">{errors.code}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nama Barang <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="text" name="name" className={`form-control ${errors.name ? 'is-invalid' : ''}`} placeholder="Contoh: Kertas A4" value={formData.name} onChange={handleInputChange} disabled={submitting} />
                    {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Kategori <span style={{ color: 'var(--danger)' }}>*</span></label>
                    {categories.length === 0 ? (
                      <p className="alert alert-warning" style={{ margin: 0 }}>Tambahkan kategori dahulu!</p>
                    ) : (
                      <select name="category_id" className={`form-control ${errors.category_id ? 'is-invalid' : ''}`} value={formData.category_id} onChange={handleInputChange} disabled={submitting}>
                        <option value="">Pilih Kategori</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                    {errors.category_id && <div className="invalid-feedback">{errors.category_id}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Satuan <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input type="text" name="unit" className={`form-control ${errors.unit ? 'is-invalid' : ''}`} placeholder="pcs, box, kg, liter..." value={formData.unit} onChange={handleInputChange} disabled={submitting} />
                    {errors.unit && <div className="invalid-feedback">{errors.unit}</div>}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Harga Satuan (Rp)</label>
                    <input type="number" name="price" min="0" step="any" className={`form-control ${errors.price ? 'is-invalid' : ''}`} value={formData.price} onChange={handleInputChange} disabled={submitting} />
                    {errors.price && <div className="invalid-feedback">{errors.price}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stok Minimum</label>
                    <input type="number" name="min_stock" min="0" className={`form-control ${errors.min_stock ? 'is-invalid' : ''}`} value={formData.min_stock} onChange={handleInputChange} disabled={submitting} />
                    {errors.min_stock && <div className="invalid-feedback">{errors.min_stock}</div>}
                  </div>
                </div>
                {!editingItem ? (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Stok Awal</label>
                    <input type="number" name="stock" min="0" className={`form-control ${errors.stock ? 'is-invalid' : ''}`} value={formData.stock} onChange={handleInputChange} disabled={submitting} />
                    {errors.stock && <div className="invalid-feedback">{errors.stock}</div>}
                    <p className="form-hint">Perubahan stok selanjutnya dilakukan via halaman Transaksi.</p>
                  </div>
                ) : (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Stok Saat Ini</label>
                    <input type="text" className="form-control" value={`${formData.stock} ${formData.unit}`} disabled style={{ opacity: 0.6 }} />
                    <p className="form-hint">Untuk mengubah stok, gunakan halaman <strong>Transaksi Stok</strong>.</p>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={submitting}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={submitting || categories.length === 0}>
                  {submitting ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Tambah Barang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Hapus Barang"
        message={`Hapus barang "${confirmDelete?.name}" (${confirmDelete?.code})? Barang yang memiliki riwayat transaksi tidak dapat dihapus.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      {alertOpen && (
        <div className="modal-overlay" onClick={() => setAlertOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="var(--warning)" style={{ width: '20px', height: '20px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '700' }}>Akses Pendataan Dibatasi</h3>
              </div>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.88rem', margin: 0 }}>
                Minimal <strong>5 pengguna terdaftar</strong> diperlukan dalam sistem sebelum dapat melakukan penambahan barang baru.<br/><br/>
                Jumlah pengguna terdaftar saat ini: <strong style={{ color: 'var(--warning)' }}>{userCount} / 5</strong>.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setAlertOpen(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
