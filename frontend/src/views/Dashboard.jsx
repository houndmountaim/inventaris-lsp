import React, { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '../utils/api';

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

function SkeletonCard() {
  return (
    <div className="stat-card">
      <div className="stat-details" style={{ gap: '8px', width: '100%' }}>
        <span className="skeleton" style={{ width: '80px', height: '32px' }} />
        <span className="skeleton" style={{ width: '120px', height: '14px' }} />
      </div>
      <span className="skeleton" style={{ width: '46px', height: '46px', borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/api/dashboard/stats')
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ── Semua useMemo HARUS di sini, sebelum early return, sesuai Rules of Hooks ──
  const COLOR_MAP = useMemo(() => ({
    accent:  { color: 'var(--accent-color)', bg: 'rgba(99,102,241,0.12)' },
    success: { color: 'var(--success)',       bg: 'var(--success-light)'  },
    warning: { color: 'var(--warning)',        bg: 'var(--warning-light)' },
    danger:  { color: 'var(--danger)',         bg: 'var(--danger-light)'  },
  }), []);

  const counts = stats?.counts || {};
  const statCards = useMemo(() => [
    {
      value: counts.items ?? '—', label: 'Total Barang', color: 'accent',
      iconD: 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9',
    },
    {
      value: counts.categories ?? '—', label: 'Kategori', color: 'success',
      iconD: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a1.125 1.125 0 001.591 0l4.318-4.318a1.125 1.125 0 000-1.591L9.568 3.659A2.25 2.25 0 007.977 3zM6 6h.008v.008H6V6z',
    },
    {
      value: counts.transactions ?? '—', label: 'Total Transaksi', color: 'warning',
      iconD: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
    },
    {
      value: counts.stockValue != null ? formatRupiah(counts.stockValue) : '—',
      label: 'Nilai Aset Stok', color: 'danger', small: true,
      iconD: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [stats]);

  // Logika status: Tersedia (> min), Warning (= min), Tidak Tersedia (< min)
  const getStockStatus = (stock, minStock) => {
    if (stock > minStock)  return { label: 'Tersedia',         cls: 'badge-success' };
    if (stock === minStock) return { label: 'Warning',         cls: 'badge-pulse-warning' };
    return                         { label: 'Tidak Tersedia',  cls: 'badge-pulse-danger' };
  };

  if (error) return <div className="alert alert-danger">{error}</div>;

  if (loading) {
    return (
      <div>
        <div className="stat-grid">
          {[0,1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
        <div className="charts-grid">
          {[0,1].map(i => (
            <div key={i} className="card">
              <span className="skeleton" style={{ display: 'block', width: '40%', height: '18px', marginBottom: '18px' }} />
              <span className="skeleton" style={{ display: 'block', width: '100%', height: '220px' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { lowStockAlerts, charts } = stats;

  const renderLowStockChart = () => {
    const data = charts.lowStock || [];
    if (!data.length) return <div className="empty-state"><p>Tidak ada barang dengan stok di bawah 10.</p></div>;
    const svgW = 480, svgH = 210, mL = 130, mR = 40, mT = 16, mB = 24;
    const cW = svgW - mL - mR, cH = svgH - mT - mB, bH = 20, gap = 12;
    const maxVal = Math.max(...data.map(d => d.stock), 10);
    return (
      <div className="chart-container">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="chart-svg">
          {[0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal].map((tick, i) => {
            const x = mL + (tick / maxVal) * cW;
            return (
              <g key={i}>
                <line x1={x} y1={mT} x2={x} y2={mT + cH} className="chart-grid-line" />
                <text x={x} y={mT + cH + 16} textAnchor="middle" className="chart-text">{Math.round(tick)}</text>
              </g>
            );
          })}
          <line x1={mL} y1={mT} x2={mL} y2={mT + cH} className="chart-axis-line" />
          {data.map((item, idx) => {
            const y = mT + idx * (bH + gap) + 4;
            const bW = Math.max(4, (item.stock / maxVal) * cW);
            const crit = item.stock <= 3;
            return (
              <g key={item.name}>
                <text x={mL - 10} y={y + 14} textAnchor="end" className="chart-text" style={{ fill: 'var(--text-primary)', fontWeight: '500' }}>
                  {item.name.length > 18 ? item.name.substring(0, 16) + '…' : item.name}
                </text>
                <rect x={mL} y={y} width={bW} height={bH} rx={4} fill={crit ? 'var(--danger)' : 'var(--warning)'} opacity={0.85} className="chart-bar" />
                <text x={mL + bW + 7} y={y + 14} textAnchor="start" className="chart-text" style={{ fontWeight: '600', fill: crit ? 'var(--danger)' : 'var(--warning)' }}>{item.stock}</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const renderHighStockChart = () => {
    const data = charts.highStock || [];
    if (!data.length) return <div className="empty-state"><p>Tidak ada barang dalam sistem.</p></div>;
    const svgW = 480, svgH = 210, mL = 40, mR = 14, mT = 18, mB = 38;
    const cW = svgW - mL - mR, cH = svgH - mT - mB, bW = 34;
    const gap = (cW - bW * data.length) / (data.length + 1);
    const maxVal = Math.max(...data.map(d => d.stock), 10);
    const roundMax = Math.ceil(maxVal / 10) * 10;
    return (
      <div className="chart-container">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="chart-svg">
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const val = Math.round(pct * roundMax), y = mT + cH - pct * cH;
            return (
              <g key={i}>
                <line x1={mL} y1={y} x2={mL + cW} y2={y} className="chart-grid-line" />
                <text x={mL - 8} y={y + 4} textAnchor="end" className="chart-text">{val}</text>
              </g>
            );
          })}
          <line x1={mL} y1={mT + cH} x2={mL + cW} y2={mT + cH} className="chart-axis-line" />
          {data.map((item, idx) => {
            const x = mL + gap + idx * (bW + gap);
            const pct = item.stock / roundMax, bH = Math.max(3, pct * cH), y = mT + cH - bH;
            return (
              <g key={item.name}>
                <rect x={x} y={y} width={bW} height={bH} rx={4} fill="var(--accent-color)" opacity={0.8} className="chart-bar" />
                <text x={x + bW / 2} y={y - 5} textAnchor="middle" className="chart-text" style={{ fontWeight: '600', fill: 'var(--accent-color)' }}>{item.stock}</text>
                <text x={x + bW / 2} y={mT + cH + 14} textAnchor="middle" className="chart-text" style={{ fill: 'var(--text-primary)' }}>
                  {item.name.length > 8 ? item.name.substring(0, 7) + '..' : item.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div>
      <div className="stat-grid">
        {statCards.map((card, i) => {
          const c = COLOR_MAP[card.color];
          return (
            <div key={i} className="stat-card">
              <div className="stat-details">
                <span className="stat-value" style={card.small ? { fontSize: '1.2rem' } : {}}>{card.value}</span>
                <span className="stat-label">{card.label}</span>
              </div>
              <div className="stat-icon" style={{ color: c.color, backgroundColor: c.bg }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={card.iconD} />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      <div className="charts-grid">
        <div className="card">
          <div className="card-title">
            <span>5 Stok Terendah (Kritis)</span>
            <span className="badge badge-pulse-warning">Perlu Restock</span>
          </div>
          {renderLowStockChart()}
        </div>
        <div className="card">
          <div className="card-title">
            <span>5 Stok Tertinggi</span>
            <span className="badge badge-primary">Top Items</span>
          </div>
          {renderHighStockChart()}
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ color: 'var(--warning)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span>Peringatan Stok Tipis / Kosong</span>
          </div>
          <span className="badge badge-warning">{lowStockAlerts.length} Barang</span>
        </div>
        {lowStockAlerts.length === 0 ? (
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ color: 'var(--success)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p style={{ color: 'var(--success)' }}>Semua stok barang berada di atas batas minimum.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th><th>Nama Barang</th><th>Kategori</th>
                  <th style={{ textAlign: 'right' }}>Stok</th>
                  <th style={{ textAlign: 'right' }}>Min</th>
                  <th>Satuan</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lowStockAlerts.map(item => (
                  <tr key={item.id}>
                    <td><code style={{ fontSize: '0.82rem', color: 'var(--accent-color)' }}>{item.code}</code></td>
                    <td style={{ fontWeight: '600' }}>{item.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{item.category_name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: item.stock < item.min_stock ? 'var(--danger)' : item.stock === item.min_stock ? 'var(--warning)' : 'var(--success)' }}>{item.stock}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{item.min_stock}</td>
                    <td>{item.unit}</td>
                    <td>
                      {(() => {
                        const { label, cls } = getStockStatus(item.stock, item.min_stock);
                        return <span className={`badge ${cls}`}>{label}</span>;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
