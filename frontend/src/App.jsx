import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { apiRequest, setAuthToken, getAuthToken } from './utils/api';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import Categories from './views/Categories';
import Items from './views/Items';
import Transactions from './views/Transactions';
import Reports from './views/Reports';
import Users from './views/Users';

const NAV_ITEMS = [
  {
    path: '/',
    label: 'Dashboard',
    icon: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
  },
  {
    path: '/categories',
    label: 'Kategori Barang',
    icon: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a1.125 1.125 0 001.591 0l4.318-4.318a1.125 1.125 0 000-1.591L9.568 3.659A2.25 2.25 0 007.977 3zM6 6h.008v.008H6V6z',
  },
  {
    path: '/items',
    label: 'Daftar Barang',
    icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  },
  {
    path: '/transactions',
    label: 'Transaksi Stok',
    icon: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
  },
  {
    path: '/reports',
    label: 'Laporan',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  },
];

const ADMIN_NAV = {
  path: '/users',
  label: 'Kelola Pengguna',
  icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
};

const PAGE_TITLES = {
  '/': 'Ringkasan Dashboard',
  '/categories': 'Kelola Kategori Barang',
  '/items': 'Daftar Persediaan Barang',
  '/transactions': 'Transaksi Masuk & Keluar',
  '/reports': 'Laporan Mutasi & Stok',
  '/users': 'Kelola Akun Pengguna',
};

function NavIcon({ d }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [appLoading, setAppLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 5);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  const verifySession = async () => {
    const token = getAuthToken();
    if (!token) { setAppLoading(false); return; }
    try {
      const data = await apiRequest('/api/auth/me');
      setUser(data.user);
    } catch {
      setAuthToken(null);
    } finally {
      setAppLoading(false);
    }
  };

  useEffect(() => {
    verifySession();
    const onAuthFailed = () => {
      setUser(null);
      addToast('Sesi Anda telah berakhir, silakan login kembali.', 'warning');
    };
    window.addEventListener('auth-failed', onAuthFailed);
    return () => window.removeEventListener('auth-failed', onAuthFailed);
  }, []);

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    navigate('/');
    addToast('Anda telah berhasil keluar dari sistem.', 'info');
  };

  if (appLoading) {
    return (
      <div className="splash-screen">
        <div className="splash-spinner" />
        <span>Menghubungkan ke server...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Login onLoginSuccess={(u) => { setUser(u); addToast(`Selamat datang, ${u.name}!`, 'success'); }} />
        <ToastStack toasts={toasts} />
      </>
    );
  }

  const navItems = user.role === 'Admin' ? [...NAV_ITEMS, ADMIN_NAV] : NAV_ITEMS;
  const pageTitle = PAGE_TITLES[location.pathname] || 'Inventory';

  return (
    <div className="app-container">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
          </svg>
          <h1>PERSIS GUDANG</h1>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <NavIcon d={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">{user.name?.charAt(0).toUpperCase() || 'U'}</div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-role">{user.role}</span>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '18px', height: '18px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Keluar
          </button>
        </div>
      </aside>

      <div className="main-wrapper">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '26px', height: '26px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <h2 className="page-title">{pageTitle}</h2>
          </div>
          <span className="badge badge-primary">{user.role}</span>
        </header>

        <main className="content-container">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/categories" element={<Categories addToast={addToast} />} />
            <Route path="/items" element={<Items addToast={addToast} />} />
            <Route path="/transactions" element={<Transactions addToast={addToast} />} />
            <Route path="/reports" element={<Reports addToast={addToast} />} />
            <Route
              path="/users"
              element={user.role === 'Admin' ? <Users addToast={addToast} currentUser={user} /> : <Navigate to="/" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <ToastStack toasts={toasts} />
    </div>
  );
}

function ToastStack({ toasts }) {
  const ICONS = {
    success: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    danger: 'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    warning: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z',
    info: 'M11.25 11.25l.041-.02a.75.75 0 011.083.87l-.512 1.902a.75.75 0 00.954.91l.04-.017M12 6.75h.008v.008H12V6.75zM21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  };
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px', flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[t.type] || ICONS.info} />
          </svg>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
