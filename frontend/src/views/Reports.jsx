import React, { useEffect, useState, useRef } from 'react';
import { apiRequest } from '../utils/api';
import * as XLSX from 'xlsx';

const formatRupiah = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const formatDate = () => new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

export default function Reports({ addToast }) {
  const [reportData, setReportData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', type: 'ALL', categoryId: '' });
  const [exporting, setExporting] = useState(false);
  const printRef = useRef(null);

  const fetchReport = async (f = filters) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (f.startDate)   q.append('startDate', f.startDate);
      if (f.endDate)     q.append('endDate', f.endDate);
      if (f.type)        q.append('type', f.type);
      if (f.categoryId)  q.append('categoryId', f.categoryId);
      setReportData(await apiRequest(`/api/reports?${q}`));
    } catch (e) { addToast(e.message, 'danger'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    apiRequest('/api/categories').then(setCategories).catch(() => {});
    fetchReport();
  }, []);

  const handleFilterChange = (e) => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));
  const handleApply = (e) => { e.preventDefault(); fetchReport(); };
  const handleReset = () => {
    const f = { startDate: '', endDate: '', type: 'ALL', categoryId: '' };
    setFilters(f); fetchReport(f);
  };

  // ── Fungsi menentukan status persediaan ──────────────────────────────
  const getStockStatus = (stock, minStock) => {
    if (stock > minStock) return { label: 'Tersedia',       cls: 'badge-success' };
    if (stock === minStock) return { label: 'Warning',      cls: 'badge-warning' };
    return                         { label: 'Tidak Tersedia', cls: 'badge-danger' };
  };

  // ── Ekspor Excel ──────────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (!reportData) return;
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Riwayat Mutasi
      const txHeaders = ['Tanggal', 'Kode', 'Nama Barang', 'Kategori', 'Tipe', 'Jumlah', 'Satuan', 'Harga Satuan', 'Operator'];
      const txRows = reportData.transactions.map(t => [
        t.date,
        t.item_code,
        t.item_name,
        t.category_name,
        t.type === 'IN' ? 'Masuk' : 'Keluar',
        t.type === 'IN' ? t.quantity : -t.quantity,
        t.item_unit,
        t.item_price,
        t.operator_name,
      ]);
      const ws1 = XLSX.utils.aoa_to_sheet([txHeaders, ...txRows]);
      // Lebar kolom otomatis
      ws1['!cols'] = [16, 12, 28, 18, 10, 10, 10, 16, 18].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws1, 'Riwayat Mutasi');

      // Sheet 2: Posisi Stok
      const stHeaders = ['No', 'Kategori', 'Kode', 'Nama Barang', 'Stok', 'Satuan', 'Stok Minimum', 'Harga Satuan', 'Nilai Aset', 'Status'];
      const stRows = reportData.stockReport.map((item, idx) => {
        const { label } = getStockStatus(item.stock, item.min_stock);
        return [
          idx + 1,
          item.category_name,
          item.item_code,
          item.item_name,
          item.stock,
          item.unit,
          item.min_stock,
          item.price,
          item.stock * item.price,
          label,
        ];
      });
      const ws2 = XLSX.utils.aoa_to_sheet([stHeaders, ...stRows]);
      ws2['!cols'] = [5, 18, 12, 28, 8, 8, 14, 16, 18, 16].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws2, 'Posisi Stok');

      const fileName = `Laporan_Inventaris_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      addToast('File Excel berhasil diunduh!', 'success');
    } catch (err) {
      addToast('Gagal mengekspor Excel: ' + err.message, 'danger');
    } finally {
      setExporting(false);
    }
  };

  // ── Cetak / PDF ──────────────────────────────────────────────────────
  const handlePrint = () => window.print();

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span>Filter Laporan</span>
          {reportData && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>{reportData.summary.recordCount} transaksi ditemukan</span>}
        </div>
        <form onSubmit={handleApply}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '14px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tanggal Mulai</label>
              <input type="date" name="startDate" className="form-control" value={filters.startDate} onChange={handleFilterChange} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tanggal Selesai</label>
              <input type="date" name="endDate" className="form-control" value={filters.endDate} onChange={handleFilterChange} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tipe Transaksi</label>
              <select name="type" className="form-control" value={filters.type} onChange={handleFilterChange}>
                <option value="ALL">Semua</option>
                <option value="IN">Masuk</option>
                <option value="OUT">Keluar</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Kategori</label>
              <select name="categoryId" className="form-control" value={filters.categoryId} onChange={handleFilterChange}>
                <option value="">Semua</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>Reset Filter</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Memuat...' : 'Terapkan Filter'}
            </button>
          </div>
        </form>
      </div>

      {loading && (
        <div className="card">
          {[0,1,2,3].map(i => (
            <div key={i} className="skeleton-row">
              <span className="skeleton" style={{ width: '80px', height: '14px' }} />
              <span className="skeleton" style={{ flex: 1, height: '14px' }} />
              <span className="skeleton" style={{ width: '60px', height: '22px', borderRadius: '9999px' }} />
              <span className="skeleton" style={{ width: '80px', height: '14px' }} />
            </div>
          ))}
        </div>
      )}

      {!loading && reportData && (
        <div ref={printRef}>
          {/* Header cetak – hanya muncul saat print */}
          <div className="print-header">
            <h1>LAPORAN MANAJEMEN PERSEDIAAN BARANG</h1>
            <p>Dicetak: {new Date().toLocaleString('id-ID')}</p>
          </div>

          {/* ── Tombol Aksi Ekspor ─────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>Hasil Laporan</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {/* Tombol Ekspor Excel */}
              <button
                id="btn-export-excel"
                className="btn btn-secondary"
                onClick={handleExportExcel}
                disabled={exporting}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '17px', height: '17px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5H12m-1.125-1.5c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.5 12.75h-7.5m7.5 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125h-7.5" />
                </svg>
                {exporting ? 'Mengekspor...' : 'Ekspor Excel'}
              </button>

              {/* Tombol Cetak / PDF */}
              <button
                id="btn-print-report"
                className="btn btn-secondary"
                onClick={handlePrint}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '17px', height: '17px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                </svg>
                Cetak / PDF
              </button>
            </div>
          </div>

          {/* ── Ringkasan Statistik ────────────────────────────────────── */}
          <div className="stat-grid" style={{ marginBottom: '20px' }}>
            {[
              { value: reportData.summary.recordCount, label: 'Total Transaksi' },
              { value: `+${reportData.summary.totalQtyIn}`, label: 'Total Qty Masuk', color: 'var(--success)' },
              { value: `-${reportData.summary.totalQtyOut}`, label: 'Total Qty Keluar', color: 'var(--danger)' },
              { value: formatRupiah(reportData.summary.totalValueIn + reportData.summary.totalValueOut), label: 'Total Nilai Mutasi', small: true },
            ].map((c, i) => (
              <div key={i} className="stat-card">
                <div className="stat-details">
                  <span className="stat-value" style={c.small ? { fontSize: '1.1rem' } : c.color ? { color: c.color } : {}}>{c.value}</span>
                  <span className="stat-label">{c.label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Detail Riwayat Mutasi ──────────────────────────────────── */}
          <div className="card">
            <div className="card-title">
              <span>Detail Riwayat Mutasi</span>
              <span className="badge badge-primary">{reportData.transactions.length} data</span>
            </div>
            {reportData.transactions.length === 0 ? (
              <div className="empty-state"><p>Tidak ada riwayat mutasi untuk filter ini.</p></div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tanggal</th><th>Kode</th><th>Nama Barang</th><th>Kategori</th>
                      <th>Tipe</th>
                      <th style={{ textAlign: 'right' }}>Jumlah</th>
                      <th>Satuan</th>
                      <th style={{ textAlign: 'right' }}>Harga</th>
                      <th>Operator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.transactions.map(t => (
                      <tr key={t.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t.date}</td>
                        <td><code style={{ fontSize: '0.82rem', color: 'var(--accent-color)' }}>{t.item_code}</code></td>
                        <td style={{ fontWeight: '500' }}>{t.item_name}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{t.category_name}</td>
                        <td>{t.type === 'IN' ? <span className="badge badge-success">Masuk</span> : <span className="badge badge-danger">Keluar</span>}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: t.type === 'IN' ? 'var(--success)' : 'var(--danger)' }}>
                          {t.type === 'IN' ? '+' : '-'}{t.quantity}
                        </td>
                        <td>{t.item_unit}</td>
                        <td style={{ textAlign: 'right' }}>{formatRupiah(t.item_price)}</td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t.operator_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Posisi Stok Gudang ─────────────────────────────────────── */}
          <div className="card" style={{ pageBreakBefore: 'always' }}>
            <div className="card-title">
              <span>Posisi Stok Gudang (Real-Time)</span>
              <span className="badge badge-primary">{reportData.stockReport.length} item</span>
            </div>
            {reportData.stockReport.length === 0 ? (
              <div className="empty-state"><p>Tidak ada data stok.</p></div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>No</th><th>Kategori</th><th>Kode</th><th>Nama</th>
                      <th style={{ textAlign: 'right' }}>Stok</th>
                      <th style={{ textAlign: 'right' }}>Min</th>
                      <th>Satuan</th>
                      <th style={{ textAlign: 'right' }}>Harga</th>
                      <th style={{ textAlign: 'right' }}>Nilai Aset</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.stockReport.map((item, idx) => {
                      const { label, cls } = getStockStatus(item.stock, item.min_stock);
                      const stockColor = item.stock < item.min_stock
                        ? 'var(--danger)'
                        : item.stock === item.min_stock
                        ? 'var(--warning)'
                        : 'var(--success)';
                      return (
                        <tr key={item.item_code}>
                          <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{item.category_name}</td>
                          <td><code style={{ fontSize: '0.82rem', color: 'var(--accent-color)' }}>{item.item_code}</code></td>
                          <td style={{ fontWeight: '500' }}>{item.item_name}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: stockColor }}>{item.stock}</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{item.min_stock}</td>
                          <td>{item.unit}</td>
                          <td style={{ textAlign: 'right' }}>{formatRupiah(item.price)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatRupiah(item.stock * item.price)}</td>
                          <td><span className={`badge ${cls}`}>{label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer cetak */}
          <div className="print-footer" style={{ display: 'none' }}>
            <p>Laporan dibuat secara otomatis oleh Sistem Inventaris LSP &bull; {formatDate()}</p>
          </div>
        </div>
      )}
    </div>
  );
}
