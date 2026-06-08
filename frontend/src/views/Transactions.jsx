import React, { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '../utils/api';

export default function Transactions({ addToast }) {
  const [transactions, setTransactions] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('history');
  const [formData, setFormData] = useState({
    item_id: '', type: 'IN', quantity: '',
    date: new Date().toISOString().split('T')[0], notes: '',
  });
  const [selectedItem, setSelectedItem] = useState(null);
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');


  const resetForm = () => {
    setFormData({
      item_id: '', type: 'IN', quantity: '',
      date: new Date().toISOString().split('T')[0], notes: '',
    });
    setSelectedItem(null);
    setFormError('');
    setErrors({});
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [t, i] = await Promise.all([
        apiRequest('/api/transactions').catch(e => { console.error('Error fetch transactions:', e); return []; }),
        apiRequest('/api/items').catch(e => { console.error('Error fetch items:', e); return []; }),
      ]);
      setTransactions(Array.isArray(t) ? t : []);
      setItems(Array.isArray(i) ? i : []);
      if (!Array.isArray(t) || !Array.isArray(i)) {
        addToast('Gagal memuat sebagian data. Coba refresh halaman.', 'warning');
      }
    } catch (e) {
      addToast(e.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: value }));
    if (name === 'item_id') {
      const sel = items.find(i => String(i.id) === String(value));
      setSelectedItem(sel || null);
    }
    if (errors[name]) setErrors(p => { const copy = { ...p }; delete copy[name]; return copy; });
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { item_id, type, quantity, date, notes } = formData;

    const newErrors = {};
    if (!item_id) {
      newErrors.item_id = 'Pilih barang terlebih dahulu';
    }
    if (!type) {
      newErrors.type = 'Pilih jenis transaksi';
    }

    const qty = parseInt(quantity);
    if (quantity === '' || isNaN(qty) || qty <= 0) {
      newErrors.quantity = 'Jumlah harus lebih dari 0';
    } else if (type === 'OUT' && selectedItem && qty > selectedItem.stock) {
      newErrors.quantity = `Stok tidak mencukupi! Maksimal: ${selectedItem.stock} ${selectedItem.unit}`;
    }

    if (!date) {
      newErrors.date = 'Tanggal transaksi wajib diisi';
    }

    if (notes && notes.trim().length > 200) {
      newErrors.notes = 'Catatan maksimal 200 karakter';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setFormError('Mohon perbaiki kesalahan input di bawah.');
      return;
    }

    setSubmitting(true); setFormError(''); setErrors({});
    try {
      await apiRequest('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({ item_id: parseInt(item_id), type, quantity: qty, date, notes: notes ? notes.trim() : '' }),
      });
      addToast('Transaksi berhasil disimpan', 'success');
      resetForm();
      await fetchData();
      setActiveTab('history');
    } catch (e) { setFormError(e.message); }
    finally { setSubmitting(false); }
  };

  const filteredTrans = useMemo(() => {
    return transactions.filter(t =>
      (t.item_name + t.item_code + t.operator_name + (t.notes || '')).toLowerCase().includes(search.toLowerCase())
    );
  }, [transactions, search]);

  return (
    <div>
      <div className="tab-nav">
        <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => { setActiveTab('history'); resetForm(); }}>
          Riwayat Transaksi
          {transactions.length > 0 && <span className="badge badge-primary" style={{ marginLeft: '8px', fontSize: '0.68rem' }}>{transactions.length}</span>}
        </button>
        <button className={`tab-btn ${activeTab === 'new' ? 'active' : ''}`} onClick={() => {
          setActiveTab('new'); resetForm();
        }}>
          + Catat Transaksi Baru
        </button>
      </div>

      {activeTab === 'history' && (
        <div>
          <div className="filter-bar">
            <div className="filter-inputs">
              <input
                type="text" className="form-control" placeholder="Cari barang, operator, catatan..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ maxWidth: '300px' }}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                {filteredTrans.length} transaksi
              </span>
            </div>
            <button className="btn btn-primary" onClick={() => {
              setActiveTab('new'); resetForm();
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '17px', height: '17px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Input Transaksi
            </button>
          </div>
          <div className="card">
            {loading ? (
              <div>
                {[0,1,2,3,4].map(i => (
                  <div key={i} className="skeleton-row">
                    <span className="skeleton" style={{ width: '90px', height: '14px' }} />
                    <span className="skeleton" style={{ width: '70px', height: '14px' }} />
                    <span className="skeleton" style={{ flex: 1, height: '14px' }} />
                    <span className="skeleton" style={{ width: '60px', height: '22px', borderRadius: '9999px' }} />
                  </div>
                ))}
              </div>
            ) : filteredTrans.length === 0 ? (
              <div className="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
                <p>{search ? `Tidak ada transaksi untuk "${search}"` : 'Belum ada riwayat transaksi.'}</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tanggal</th><th>Kode</th><th>Nama Barang</th>
                      <th>Tipe</th>
                      <th style={{ textAlign: 'right' }}>Jumlah</th>
                      <th>Satuan</th><th>Operator</th><th>Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrans.map(t => (
                      <tr key={t.id}>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{t.date}</td>
                        <td><code style={{ fontSize: '0.82rem', color: 'var(--accent-color)' }}>{t.item_code}</code></td>
                        <td style={{ fontWeight: '500' }}>{t.item_name}</td>
                        <td>
                          {t.type === 'IN'
                            ? <span className="badge badge-success">Masuk</span>
                            : <span className="badge badge-danger">Keluar</span>}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: t.type === 'IN' ? 'var(--success)' : 'var(--danger)' }}>
                          {t.type === 'IN' ? '+' : '-'}{t.quantity}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{t.item_unit}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t.operator_name}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'new' && (
        <div style={{ maxWidth: '580px', margin: '0 auto' }}>
          <div className="card">
            <h3 style={{ marginBottom: '20px', fontSize: '1.1rem', fontWeight: '700' }}>Formulir Transaksi Persediaan</h3>
            {formError && <div className="alert alert-danger">{formError}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Pilih Barang <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select name="item_id" className={`form-control ${errors.item_id ? 'is-invalid' : ''}`} value={formData.item_id} onChange={handleInputChange} disabled={submitting}>
                  <option value="">— Pilih Barang —</option>
                  {items.map(i => (
                    <option key={i.id} value={i.id}>[{i.code}] {i.name} — Stok: {i.stock} {i.unit}</option>
                  ))}
                </select>
                {errors.item_id && <div className="invalid-feedback">{errors.item_id}</div>}
              </div>

              {selectedItem && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
                  <div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Stok Saat Ini</span>
                    <span style={{ fontWeight: '700', fontSize: '1.1rem', color: selectedItem.stock > selectedItem.min_stock ? 'var(--success)' : selectedItem.stock === selectedItem.min_stock ? 'var(--warning)' : 'var(--danger)' }}>
                      {selectedItem.stock} {selectedItem.unit}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Min. Stok</span>
                    <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>{selectedItem.min_stock} {selectedItem.unit}</span>
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Jenis Transaksi <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select name="type" className={`form-control ${errors.type ? 'is-invalid' : ''}`} value={formData.type} onChange={handleInputChange} disabled={submitting}>
                    <option value="IN">Barang Masuk (+ Stok)</option>
                    <option value="OUT">Barang Keluar (− Stok)</option>
                  </select>
                  {errors.type && <div className="invalid-feedback">{errors.type}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Jumlah <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="number" name="quantity" min="1" className={`form-control ${errors.quantity ? 'is-invalid' : ''}`}
                    placeholder="0" value={formData.quantity}
                    onChange={handleInputChange} disabled={submitting}
                  />
                  {errors.quantity && <div className="invalid-feedback">{errors.quantity}</div>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Tanggal Transaksi <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="date" name="date" className={`form-control ${errors.date ? 'is-invalid' : ''}`} value={formData.date} onChange={handleInputChange} disabled={submitting} />
                {errors.date && <div className="invalid-feedback">{errors.date}</div>}
              </div>

              <div className="form-group" style={{ marginBottom: '22px' }}>
                <label className="form-label">Catatan</label>
                <textarea
                  name="notes" className={`form-control ${errors.notes ? 'is-invalid' : ''}`} rows="3"
                  placeholder="Keterangan tambahan (opsional)..."
                  value={formData.notes} onChange={handleInputChange} disabled={submitting}
                />
                {errors.notes && <div className="invalid-feedback">{errors.notes}</div>}
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setActiveTab('history'); resetForm(); }} disabled={submitting}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={submitting || items.length === 0}>
                  {submitting ? 'Menyimpan...' : formData.type === 'IN' ? '+ Simpan Transaksi Masuk' : '− Simpan Transaksi Keluar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}
