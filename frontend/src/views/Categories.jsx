import React, { useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Categories({ addToast }) {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [modalError, setModalError] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchCategories = async () => {
    setLoading(true);
    try { setCategories(await apiRequest('/api/categories')); }
    catch (e) { addToast(e.message, 'danger'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCategories(); }, []);

  const openAddModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '' });
    setModalError('');
    setErrors({});
    setModalOpen(true);
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setFormData({ name: cat.name, description: cat.description || '' });
    setModalError('');
    setErrors({});
    setModalOpen(true);
  };

  const handleInputChange = (field, val) => {
    setFormData(p => ({ ...p, [field]: val }));
    if (errors[field]) setErrors(p => { const copy = { ...p }; delete copy[field]; return copy; });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Nama kategori wajib diisi';
    } else if (formData.name.trim().length > 50) {
      newErrors.name = 'Nama kategori maksimal 50 karakter';
    }
    if (formData.description && formData.description.trim().length > 200) {
      newErrors.description = 'Deskripsi maksimal 200 karakter';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setModalError('Mohon perbaiki kesalahan input di bawah.');
      return;
    }

    setSubmitting(true); setModalError(''); setErrors({});
    try {
      if (editingCategory) {
        await apiRequest(`/api/categories/${editingCategory.id}`, { method: 'PUT', body: JSON.stringify(formData) });
        addToast('Kategori berhasil diperbarui', 'success');
      } else {
        await apiRequest('/api/categories', { method: 'POST', body: JSON.stringify(formData) });
        addToast('Kategori berhasil ditambahkan', 'success');
      }
      setModalOpen(false); fetchCategories();
    } catch (e) { setModalError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await apiRequest(`/api/categories/${confirmDelete.id}`, { method: 'DELETE' });
      addToast('Kategori berhasil dihapus', 'success');
      fetchCategories();
    } catch (e) { addToast(e.message, 'danger'); }
    finally { setConfirmDelete(null); }
  };

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="filter-bar">
        <div className="filter-inputs">
          <input
            type="text" className="form-control" placeholder="Cari kategori..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: '280px' }}
          />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
            {filtered.length} kategori
          </span>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '17px', height: '17px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Tambah Kategori
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div>
            {[0,1,2,3].map(i => (
              <div key={i} className="skeleton-row">
                <span className="skeleton" style={{ width: '24px', height: '16px' }} />
                <span className="skeleton" style={{ flex: 1, height: '16px' }} />
                <span className="skeleton" style={{ width: '40%', height: '16px' }} />
                <span className="skeleton" style={{ width: '80px', height: '28px', borderRadius: 'var(--radius-sm)' }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a1.125 1.125 0 001.591 0l4.318-4.318a1.125 1.125 0 000-1.591L9.568 3.659A2.25 2.25 0 007.977 3zM6 6h.008v.008H6V6z" />
            </svg>
            <p>{search ? `Tidak ditemukan kategori untuk "${search}"` : 'Belum ada kategori.'}</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>No</th>
                  <th>Nama Kategori</th>
                  <th>Deskripsi</th>
                  <th style={{ width: '150px', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cat, idx) => (
                  <tr key={cat.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ fontWeight: '600' }}>{cat.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{cat.description || <em style={{ color: 'var(--text-muted)' }}>—</em>}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(cat)}>Ubah</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(cat)}>Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingCategory ? 'Ubah Kategori' : 'Tambah Kategori Baru'}</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {modalError && <div className="alert alert-danger">{modalError}</div>}
                <div className="form-group">
                  <label className="form-label">Nama Kategori <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text" className={`form-control ${errors.name ? 'is-invalid' : ''}`} placeholder="Contoh: Elektronik"
                    value={formData.name} onChange={e => handleInputChange('name', e.target.value)}
                    disabled={submitting} autoFocus
                  />
                  {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Deskripsi</label>
                  <textarea
                    className={`form-control ${errors.description ? 'is-invalid' : ''}`} placeholder="Deskripsi singkat kategori ini..."
                    rows="3" value={formData.description}
                    onChange={e => handleInputChange('description', e.target.value)}
                    disabled={submitting}
                  />
                  {errors.description && <div className="invalid-feedback">{errors.description}</div>}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={submitting}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Menyimpan...' : editingCategory ? 'Simpan Perubahan' : 'Tambah Kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Hapus Kategori"
        message={`Hapus kategori "${confirmDelete?.name}"? Semua barang dalam kategori ini juga akan terhapus.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
