export function formatRupiah(n) {
  return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID')
}

// Tanggal lokal "YYYY-MM-DD" (bukan toISOString, itu UTC — bisa geser hari di WIB/WITA)
export function tanggalLokal(d = new Date()) {
  const t = new Date(d)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

export function jamMenit(d) {
  const t = new Date(d)
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
}

export function buatId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
