import { useState } from 'react'
import { formatRupiah } from '../lib/format'

const TAMPIL_AWAL = 5

/**
 * Daftar menu terlaris: tampil 5 teratas, sisanya dibuka dengan "Lihat semua".
 * Sengaja TIDAK memakai kotak gulir — halaman ini sudah punya beberapa kotak gulir,
 * dan yang penting dari peringkat adalah urutan teratas.
 * daftar: [{ nama, qty, nominal }] sudah terurut. batang: tampilkan batang proporsi.
 */
export default function PeringkatMenu({ daftar, batang = false }) {
  const [semua, setSemua] = useState(false)
  const tampil = semua ? daftar : daftar.slice(0, TAMPIL_AWAL)
  const maks = daftar[0]?.qty || 1
  const sisa = daftar.length - TAMPIL_AWAL

  if (daftar.length === 0) return <p className="catatan">Belum ada penjualan.</p>

  return (
    <>
      {tampil.map((m, i) => (
        <div key={m.nama} className={batang ? 'baris-menu-laris' : undefined}>
          <div className="baris-item" style={batang ? { borderBottom: 0, paddingBottom: 2 } : undefined}>
            <span>
              {i + 1}. {m.nama}
            </span>
            <span>
              <b>{m.qty}×</b> <small>{formatRupiah(m.nominal)}</small>
            </span>
          </div>
          {batang && <div className="batang-laris" style={{ width: `${(m.qty / maks) * 100}%` }} />}
        </div>
      ))}
      {sisa > 0 && (
        <button className="btn-teks btn-lihat-semua" onClick={() => setSemua((s) => !s)}>
          {semua ? '▲ Tutup' : `▼ Lihat semua (${daftar.length} menu)`}
        </button>
      )}
    </>
  )
}
