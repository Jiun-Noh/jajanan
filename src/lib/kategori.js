// Kategori pengeluaran. Harus sama dengan CHECK di supabase/004_belanja.sql.
// modal: true = peralatan/investasi → TIDAK mengurangi untung, dilaporkan sebagai "balik modal".
export const KATEGORI_BELANJA = [
  { id: 'Bahan', label: 'Bahan', ikon: '🥩' },
  { id: 'Bumbu', label: 'Bumbu & Saus', ikon: '🧂' },
  { id: 'Kemasan', label: 'Kemasan', ikon: '🥡' },
  { id: 'Gas', label: 'Gas & Minyak', ikon: '🔥' },
  { id: 'Lain', label: 'Lain-lain', ikon: '🧾' },
  { id: 'Peralatan', label: 'Peralatan / Modal', ikon: '🛠️', modal: true },
]

export const infoKategori = (id) => KATEGORI_BELANJA.find((k) => k.id === id) || KATEGORI_BELANJA[0]
export const termasukModal = (id) => infoKategori(id).modal === true
