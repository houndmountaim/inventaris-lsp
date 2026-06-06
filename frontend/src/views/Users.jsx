import React, { useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Users({ addToast, currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ username: '', password: '', name: '', role: 'Operator' });
  const [modalError, setModalError] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try { setUsers(await apiRequest('/api/users')); }
    catch (e) { addToast(e.message, 'danger'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({ username: '', password: '', name: '', role: 'Operator' });
    setModalError('');
    setErrors({});
    setModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({ username: user.username, password: '', name: user.name, role: user.role });
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
    const { username, password, name, role } = formData;

    const newErrors = {};
    if (!name.trim()) {
      newErrors.name = 'Nama lengkap wajib diisi';
    } else if (name.trim().length > 100) {
      newErrors.name = 'Nama lengkap maksimal 100 karakter';
    }

    if (!username.trim()) {
      newErrors.username = 'Username wajib diisi';
    } else if (/\s/g.test(username.trim())) {
      newErrors.username = 'Username tidak boleh mengandung spasi';
    } else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      newErrors.username = 'Username hanya boleh huruf, angka, dan underscore';
    } else if (username.trim().length > 50) {
      newErrors.username = 'Username maksimal 50 karakter';
    }

    if (!role) {
      newErrors.role = 'Role wajib dipilih';
    }

    if (!editingUser) {
      if (!password) {
        newErrors.password = 'Password wajib diisi untuk pengguna baru';
      } else if (password.length < 6) {
        newErrors.password = 'Password minimal 6 karakter';
      }
    } else {
      if (password && password.length < 6) {
        newErrors.password = 'Password minimal 6 karakter';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setModalError('Mohon perbaiki kesalahan input di bawah.');
      return;
    }

    setSubmitting(true); setModalError(''); setErrors({});
    try {
      const payload = { username: username.trim(), name: name.trim(), role, ...(password ? { password } : {}) };
      if (editingUser) {
        await apiRequest(`/api/users/${editingUser.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        addToast('Data pengguna berhasil diperbarui', 'success');
      } else {
        await apiRequest('/api/users', { method: 'POST', body: JSON.stringify(payload) });
        addToast('Pengguna baru berhasil ditambahkan', 'success');
      }
      setModalOpen(false); fetchUsers();
    } catch (e) { setModalError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await apiRequest(`/api/users/${confirmDelete.id}`, { method: 'DELETE' });
      addToast('Pengguna berhasil dihapus', 'success');
      fetchUsers();
    } catch (e) { addToast(e.message, 'danger'); }
    finally { setConfirmDelete(null); }
  };

  return (
    <div>
      <div className="filter-bar">
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Kelola akun login Administrator dan Operator sistem.
        </p>
        <button className="btn btn-primary" onClick={openAddModal}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '17px', height: '17px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
          </svg>
          Tambah Pengguna
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div>
            {[0,1,2].map(i => (
              <div key={i} className="skeleton-row">
                <span className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <span className="skeleton" style={{ display: 'block', width: '40%', height: '14px', marginBottom: '6px' }} />
                  <span className="skeleton" style={{ display: 'block', width: '25%', height: '12px' }} />
                </div>
                <span className="skeleton" style={{ width: '70px', height: '22px', borderRadius: '9999px' }} />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <p>Tidak ada pengguna terdaftar.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '48px' }}>No</th>
                  <th>Nama Lengkap</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Terdaftar</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr key={user.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--accent-color), var(--accent-hover))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem', color: 'white' }}>
                          {user.name?.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: '600' }}>{user.name}</span>
                        {user.id === currentUser.id && <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>Anda</span>}
                      </div>
                    </td>
                    <td><code style={{ fontSize: '0.82rem', color: 'var(--accent-color)' }}>{user.username}</code></td>
                    <td>
                      {user.role === 'Admin'
                        ? <span className="badge badge-primary">Administrator</span>
                        : <span className="badge badge-success">Operator</span>}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {new Date(user.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(user)}>Ubah</button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setConfirmDelete(user)}
                          disabled={user.id === currentUser.id}
                          style={{ opacity: user.id === currentUser.id ? 0.35 : 1, cursor: user.id === currentUser.id ? 'not-allowed' : 'pointer' }}
                          title={user.id === currentUser.id ? 'Tidak dapat menghapus akun sendiri' : ''}
                        >
                          Hapus
                        </button>
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
              <h3>{editingUser ? 'Ubah Data Pengguna' : 'Tambah Pengguna Baru'}</h3>
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
                   <label className="form-label">Nama Lengkap <span style={{ color: 'var(--danger)' }}>*</span></label>
                   <input type="text" name="name" className={`form-control ${errors.name ? 'is-invalid' : ''}`} placeholder="Contoh: Budi Santoso" value={formData.name} onChange={handleInputChange} disabled={submitting} autoFocus />
                   {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                 </div>
                 <div className="form-row">
                   <div className="form-group">
                     <label className="form-label">Username <span style={{ color: 'var(--danger)' }}>*</span></label>
                     <input type="text" name="username" className={`form-control ${errors.username ? 'is-invalid' : ''}`} placeholder="username unik" value={formData.username} onChange={handleInputChange} disabled={submitting} autoComplete="off" />
                     {errors.username && <div className="invalid-feedback">{errors.username}</div>}
                   </div>
                   <div className="form-group">
                     <label className="form-label">Role <span style={{ color: 'var(--danger)' }}>*</span></label>
                     <select name="role" className={`form-control ${errors.role ? 'is-invalid' : ''}`} value={formData.role} onChange={handleInputChange} disabled={submitting}>
                       <option value="Operator">Operator</option>
                       <option value="Admin">Administrator</option>
                     </select>
                     {errors.role && <div className="invalid-feedback">{errors.role}</div>}
                   </div>
                 </div>
                 <div className="form-group" style={{ marginBottom: 0 }}>
                   <label className="form-label">
                     Password {editingUser && <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>(kosongkan jika tidak diubah)</span>}
                     {!editingUser && <span style={{ color: 'var(--danger)' }}> *</span>}
                   </label>
                   <input type="password" name="password" className={`form-control ${errors.password ? 'is-invalid' : ''}`} placeholder={editingUser ? 'Password baru (opsional)' : 'Minimal 6 karakter'} value={formData.password} onChange={handleInputChange} disabled={submitting} autoComplete="new-password" />
                   {errors.password && <div className="invalid-feedback">{errors.password}</div>}
                 </div>
               </div>
               <div className="modal-footer">
                 <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={submitting}>Batal</button>
                 <button type="submit" className="btn btn-primary" disabled={submitting}>
                   {submitting ? 'Menyimpan...' : editingUser ? 'Simpan Perubahan' : 'Tambah Pengguna'}
                 </button>
               </div>
             </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Hapus Pengguna"
        message={`Hapus akun "${confirmDelete?.name}" (${confirmDelete?.username})? Pengguna ini tidak akan dapat login lagi.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
