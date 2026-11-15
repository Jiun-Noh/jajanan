import { useMemo, useState } from 'react'
import { formatRupiah, buatId } from '../lib/format'

const PECAHAN = [5000, 10000, 20000, 50000, 100000]

// stok null = tidak dihitung (tak terbatas)
const bisaDijual = (m) => m.tersedia && m.stok !== 0
const maksQty = (m) => (m.stok == null ? Infinity : m.stok)

export default function Kasir({ menu, onSimpan }) {
  const [keranjang, setKeranjang] = useState({}) // { idMenu: qty }
  const [kategori, setKategori] = useState('Semua')
  const [bayarBuka, setBayarBuka] = useState(false)

  const daftarKategori = ['Semua', ...new Set(menu.map((m) => m.kategori))]
  const menuTampil = menu.filter((m) => kategori === 'Semua' || m.kategori === kategori)

  const item = useMemo(
    () =>
      Object.entries(keranjang)
        .map(([id, qty]) => {
          const m = menu.find((x) => x.id === id)
          return m ? { id, nama: m.nama, emoji: m.emoji, harga: m.harga, qty, maks: maksQty(m) } : null
        })
        .filter(Boolean),
    [keranjang, menu],
  )
  const total = item.reduce((s, i) => s + i.harga * i.qty, 0)
  const jumlahItem = item.reduce((s, i) => s + i.qty, 0)

  function ubahQty(id, delta) {
    const m = menu.find((x) => x.id === id)
    setKeranjang((k) => {
      const qty = Math.min((k[id] || 0) + delta, m ? maksQty(m) : 0)
      const baru = { ...k }
      if (qty <= 0) delete baru[id]
      else baru[id] = qty
      return baru
    })
  }

  async function selesai(metode, diterima) {
    const ok = await onSimpan({
      id: buatId(),
      waktu: new Date().toISOString(),
      items: item.map(({ id, nama, harga, qty }) => ({ id, nama, harga, qty })),
      total,
      metode,
      diterima,
      kembalian: metode === 'Tunai' ? diterima - total : 0,
    })
    if (!ok) return // gagal: keranjang & layar bayar tetap, tinggal coba lagi
    setKeranjang({})
    setBayarBuka(false)
  }

  return (
    <div>
      <div className="chip-baris">
        {daftarKategori.map((k) => (
          <button key={k} className={`chip ${kategori === k ? 'aktif' : ''}`} onClick={() => setKategori(k)}>
            {k}
          </button>
        ))}
      </div>

      {menu.length === 0 && <p className="catatan">Belum ada menu. Tambahkan dulu di tab 📋 Menu.</p>}

      <div className="grid-menu">
        {menuTampil.map((m) => {
          const qty = keranjang[m.id] || 0
          const dijual = bisaDijual(m)
          return (
            <button
              key={m.id}
              className={`kartu-menu ${qty ? 'dipilih' : ''}`}
              disabled={!dijual || qty >= maksQty(m)}
              onClick={() => ubahQty(m.id, 1)}
            >
              {qty > 0 && <span className="qty-badge">{qty}</span>}
              <span className="emoji">{m.emoji}</span>
              <span className="nama">{m.nama}</span>
              <span className="harga">{dijual ? formatRupiah(m.harga) : 'HABIS'}</span>
              {dijual && m.stok != null && <span className={`sisa ${m.stok <= 3 ? 'menipis' : ''}`}>Sisa {m.stok - qty}</span>}
            </button>
          )
        })}
      </div>

      {item.length > 0 && (
        <div className="kartu" style={{ marginTop: 14 }}>
          <strong>🧾 Pesanan</strong>
          {item.map((i) => (
            <div key={i.id} className="baris-item">
              <span>
                {i.emoji} {i.nama}
                <br />
                <small>{formatRupiah(i.harga)}</small>
              </span>
              <span className="stepper">
                <button onClick={() => ubahQty(i.id, -1)}>−</button>
                <b>{i.qty}</b>
                <button onClick={() => ubahQty(i.id, 1)} disabled={i.qty >= i.maks}>+</button>
              </span>
            </div>
          ))}
          <button className="btn-teks merah" onClick={() => setKeranjang({})}>
            Kosongkan pesanan
          </button>
        </div>
      )}

      {item.length > 0 && (
        <div className="bar-bayar">
          <div>
            <small>{jumlahItem} item</small>
            <div className="total">{formatRupiah(total)}</div>
          </div>
          <button className="btn-utama" onClick={() => setBayarBuka(true)}>
            Bayar →
          </button>
        </div>
      )}

      {bayarBuka && <ModalBayar total={total} onBatal={() => setBayarBuka(false)} onSelesai={selesai} />}
    </div>
  )
}

function ModalBayar({ total, onBatal, onSelesai }) {
  const [metode, setMetode] = useState('Tunai')
  const [diterima, setDiterima] = useState(total)
  const [menyimpan, setMenyimpan] = useState(false)

  // Tombol cepat: uang pas + pecahan yang cukup buat bayar (maks. 4)
  const pilihanCepat = [total, ...PECAHAN.filter((p) => p > total)].slice(0, 4)
  const kembalian = diterima - total
  const kurang = metode === 'Tunai' && kembalian < 0

  return (
    <div className="overlay" onClick={onBatal}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-judul">
          <span>💳 Pembayaran</span>
          <button className="btn-teks" onClick={onBatal}>✕</button>
        </div>
        <div className="total-besar">{formatRupiah(total)}</div>

        <div className="pilih-metode">
          {['Tunai', 'QRIS'].map((m) => (
            <button key={m} className={metode === m ? 'aktif' : ''} onClick={() => setMetode(m)}>
              {m === 'Tunai' ? '💵' : '📱'} {m}
            </button>
          ))}
        </div>

        {metode === 'Tunai' ? (
          <>
            <label className="label">Uang diterima</label>
            <div className="chip-baris">
              {pilihanCepat.map((p, i) => (
                <button key={p} className={`chip ${diterima === p ? 'aktif' : ''}`} onClick={() => setDiterima(p)}>
                  {i === 0 ? 'Uang pas' : formatRupiah(p)}
                </button>
              ))}
            </div>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={diterima}
              onChange={(e) => setDiterima(parseInt(e.target.value, 10) || 0)}
            />
            <div className={`kembalian ${kurang ? 'merah' : ''}`}>
              {kurang ? `Kurang ${formatRupiah(-kembalian)}` : `Kembalian: ${formatRupiah(kembalian)}`}
            </div>
          </>
        ) : (
          <p className="catatan">📱 Minta pelanggan scan QRIS, tunggu notifikasi masuk, lalu tekan Selesai.</p>
        )}

        <button
          className="btn-utama lebar"
          disabled={kurang || menyimpan}
          onClick={async () => {
            setMenyimpan(true)
            await onSelesai(metode, metode === 'Tunai' ? diterima : total)
            setMenyimpan(false)
          }}
        >
          {menyimpan ? 'Menyimpan…' : '✅ Selesai'}
        </button>
      </div>
    </div>
  )
}
