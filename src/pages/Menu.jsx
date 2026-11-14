import { useState } from 'react'
import { formatRupiah, buatId } from '../lib/format'

const PILIHAN_EMOJI = ['🍟', '🥟', '🍡', '🌭', '🧈', '🍢', '🍌', '🍗', '🍜', '🍳', '🥪', '🌽', '🧋', '🍊', '☕', '💧', '🥤', '🍦']
const KATEGORI = ['Makanan', 'Minuman']
const FORM_KOSONG = { nama: '', harga: '', emoji: '🍟', kategori: 'Makanan' }

export default function Menu({ menu, onSimpan, onHapus, onMuatUlang, onKeluar, notify }) {
  const [form, setForm] = useState(null) // null = tertutup; { ...data, id? }
  const [menyimpan, setMenyimpan] = useState(false)

  async function simpan(e) {
    e.preventDefault()
    if (menyimpan) return
    const harga = parseInt(form.harga, 10) || 0
    if (!form.nama.trim() || harga <= 0) {
      notify('⚠️ Isi nama & harga')
      return
    }
    const data = { nama: form.nama.trim(), harga, emoji: form.emoji, kategori: form.kategori }
    const lama = form.id ? menu.find((m) => m.id === form.id) : null
    const item = lama ? { ...lama, ...data } : { id: buatId(), tersedia: true, ...data }
    setMenyimpan(true)
    const ok = await onSimpan(item)
    setMenyimpan(false)
    if (ok) {
      setForm(null)
      notify('✅ Menu disimpan')
    }
  }

  function hapus(m) {
    if (!window.confirm(`Hapus menu "${m.nama}"?`)) return
    onHapus(m.id)
    setForm(null)
  }

  return (
    <div>
      <button className="btn-utama lebar" onClick={() => setForm(FORM_KOSONG)}>➕ Tambah Menu</button>

      <div className="kartu">
        {menu.map((m) => (
          <div key={m.id} className="baris-item">
            <span onClick={() => setForm({ ...m, harga: String(m.harga) })} style={{ cursor: 'pointer', flex: 1 }}>
              <span style={{ fontSize: 22 }}>{m.emoji}</span> <b>{m.nama}</b>
              <br />
              <small>{m.kategori} · {formatRupiah(m.harga)}</small>
            </span>
            <label className="saklar">
              <input
                type="checkbox"
                checked={m.tersedia}
                onChange={() => onSimpan({ ...m, tersedia: !m.tersedia })}
              />
              <span>{m.tersedia ? 'Ada' : 'Habis'}</span>
            </label>
          </div>
        ))}
      </div>
      <p className="catatan">ⓘ Ketuk nama menu buat ubah. Matikan saklar kalau bahannya habis — menu jadi abu-abu di Kasir.</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <button className="btn-teks" onClick={onMuatUlang}>🔄 Muat ulang menu</button>
        <button className="btn-teks merah" onClick={onKeluar}>🔒 Keluar</button>
      </div>

      {form && (
        <div className="overlay" onClick={() => setForm(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={simpan}>
            <div className="modal-judul">
              <span>{form.id ? '✏️ Ubah Menu' : '➕ Menu Baru'}</span>
              <button type="button" className="btn-teks" onClick={() => setForm(null)}>✕</button>
            </div>
            <label className="label">Nama</label>
            <input className="input" value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} placeholder="Contoh: Kentang Goreng" />
            <label className="label">Harga (Rp)</label>
            <input className="input" type="number" inputMode="numeric" value={form.harga} onChange={(e) => setForm((f) => ({ ...f, harga: e.target.value }))} placeholder="10000" />
            <label className="label">Kategori</label>
            <div className="chip-baris">
              {KATEGORI.map((k) => (
                <button type="button" key={k} className={`chip ${form.kategori === k ? 'aktif' : ''}`} onClick={() => setForm((f) => ({ ...f, kategori: k }))}>
                  {k}
                </button>
              ))}
            </div>
            <label className="label">Ikon</label>
            <div className="grid-emoji">
              {PILIHAN_EMOJI.map((em) => (
                <button type="button" key={em} className={form.emoji === em ? 'aktif' : ''} onClick={() => setForm((f) => ({ ...f, emoji: em }))}>
                  {em}
                </button>
              ))}
            </div>
            <button className="btn-utama lebar" type="submit" disabled={menyimpan}>{menyimpan ? 'Menyimpan…' : '💾 Simpan'}</button>
            {form.id && (
              <button type="button" className="btn-teks merah" onClick={() => hapus(form)} style={{ width: '100%', marginTop: 8 }}>
                🗑️ Hapus menu ini
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
