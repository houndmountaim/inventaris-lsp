export const getAuthToken = () => localStorage.getItem('inventory_token');

export const setAuthToken = (token) => {
  if (token) { localStorage.setItem('inventory_token', token); }
  else { localStorage.removeItem('inventory_token'); }
};

export const apiRequest = async (url, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };
  
  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (err) {
    throw new Error('Tidak dapat terhubung ke server API. Pastikan server backend sudah dijalankan.');
  }

  if (response.status === 401 || response.status === 403) {
    setAuthToken(null);
    if (url !== '/api/auth/me') window.dispatchEvent(new CustomEvent('auth-failed'));
  }

  const contentType = response.headers.get('content-type') || '';
  let data = {};
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (err) {
      throw new Error('Gagal memproses respon data dari server (JSON tidak valid).');
    }
  } else {
    throw new Error(`Koneksi server terganggu (HTTP ${response.status})`);
  }

  if (!response.ok) throw new Error(data.error || 'Terjadi kesalahan sistem');
  return data;
};
