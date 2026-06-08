// URL base backend — diambil dari .env (VITE_API_URL), fallback ke localhost
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Timeout default untuk setiap request (15 detik)
const REQUEST_TIMEOUT_MS = 15_000;

export const getAuthToken = () => localStorage.getItem('inventory_token');

export const setAuthToken = (token) => {
  if (token) { localStorage.setItem('inventory_token', token); }
  else { localStorage.removeItem('inventory_token'); }
};

export const apiRequest = async (path, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  // AbortController untuk timeout otomatis
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timeout. Server tidak merespons dalam 15 detik.');
    }
    throw new Error('Tidak dapat terhubung ke server API. Pastikan server backend sudah dijalankan.');
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 401 || response.status === 403) {
    setAuthToken(null);
    if (path !== '/api/auth/me') window.dispatchEvent(new CustomEvent('auth-failed'));
  }

  const contentType = response.headers.get('content-type') || '';
  let data = {};
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      throw new Error('Gagal memproses respon data dari server (JSON tidak valid).');
    }
  } else {
    throw new Error(`Koneksi server terganggu (HTTP ${response.status})`);
  }

  if (!response.ok) throw new Error(data.error || 'Terjadi kesalahan sistem');
  return data;
};
