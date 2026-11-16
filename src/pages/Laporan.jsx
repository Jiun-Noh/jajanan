import { useEffect, useMemo, useState } from 'react'
import { formatRupiah, tanggalLokal } from '../lib/format'
import * as db from '../lib/penyimpanan'

// 'YYYY-MM' bulan ini / geser n bulan
const bulanIni = () => tanggalLokal().slice(0, 7)
function geserBulan(bulan, n) {
  const [y, m] = bulan.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const jumlahHari = (bulan) => {
  const [y, m] = bulan.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
const namaBulan = (bulan, opsi = { month: 'long', year: 'numeric' }) =>
  new Date(`${bulan}-01T00:00:00`).toLocaleDateString('id-ID', opsi)
const namaHari = (tgl) =>
  new Date(`${tgl}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
const hariKe = (tgl) => Number(tgl.slice(8, 10))

// Rupiah ringkas untuk label sumbu: 1,2 jt / 850 rb
function rupiahRingkas(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
  if (n >= 1_000) return `${Math.round(n / 1_000)} rb`
  return String(n)
}

// Ringkasan; batasHari = hanya hitung tanggal 1..batasHari (untuk perbandingan yang adil)
function ringkas(data, batasHari = 31) {
  const harian = (data?.harian || []).filter((h) => hariKe(h.tanggal) <= batasHari)
  const pgl = (data?.pengeluaran || []).filter((p) => hariKe(p.tanggal) <= batasHari)
  const omzet = harian.reduce((s, h) => s + h.omzet, 0)
  const tunai = harian.reduce((s, h) => s + h.tunai, 0)
  const pengeluaran = pgl.reduce((s, p) => s + p.nominal, 0)
  return {
    omzet,
    tunai,
    qris: omzet - tunai,
    transaksi: harian.reduce((s, h) => s + h.transaksi, 0),
    pengeluaran,
    laba: omzet - pengeluaran,
    hariJualan: harian.length,
  }
}

function persenBeda(kini, lalu) {
  if (!lalu) return null
  return Math.round(((kini - lalu) / Math.abs(lalu)) * 100)
}

function Beda({ persen }) {
  if (persen === null) return null
  if (persen === 0) return <span className="beda">= sama</span>
  const naik = persen > 0
  return (
    <span className={`beda ${naik ? 'naik' : 'turun'}`}>
      {naik ? '▲' : '▼'} {Math.abs(persen)}%
    </span>
  )
}

export default function Laporan({ onBukaHari, notify }) {
  const [bulan, setBulan] = useState(bulanIni)
  const [data, setData] = useState(null)
  const [dataLalu, setDataLalu] = useState(null)
  const [memuat, setMemuat] = useState(true)
  const [dipilih, setDipilih] = useState(null) // 'YYYY-MM-DD'
  const [tabelBuka, setTabelBuka] = useState(false)

  useEffect(() => {
    let batal = false
    setMemuat(true)
    setDipilih(null)
    Promise.all([db.ambilLaporan(bulan), db.ambilLaporan(geserBulan(bulan, -1))])
      .then(([kini, lalu]) => {
        if (batal) return
        setData(kini)
        setDataLalu(lalu)
      })
      .catch((e) => !batal && notify(`⚠️ Gagal memuat laporan: ${e.message}`))
      .finally(() => !batal && setMemuat(false))
    return () => {
      batal = true
    }
  }, [bulan, notify])

  const sedangBerjalan = bulan === bulanIni()
  // Bulan berjalan dibandingkan dengan periode yang sama bulan lalu (1..hari ini), bukan sebulan penuh
  const batasBanding = sedangBerjalan ? Number(tanggalLokal().slice(8, 10)) : 31
  const r = useMemo(() => ringkas(data), [data])
  const rLalu = useMemo(() => ringkas(dataLalu, batasBanding), [dataLalu, batasBanding])
  const bulanLalu = geserBulan(bulan, -1)
  const labelBanding = sedangBerjalan
    ? `vs 1–${Math.min(batasBanding, jumlahHari(bulanLalu))} ${namaBulan(bulanLalu, { month: 'short' })}`
    : `vs ${namaBulan(bulanLalu, { month: 'long' })}`

  // Data per tanggal untuk grafik & tabel
  const perHari = useMemo(() => {
    const n = jumlahHari(bulan)
    const peta = Object.fromEntries((data?.harian || []).map((h) => [h.tanggal, h]))
    const pgl = Object.fromEntries((data?.pengeluaran || []).map((p) => [p.tanggal, p.nominal]))
    const hariIni = tanggalLokal()
    return Array.from({ length: n }, (_, i) => {
      const tgl = `${bulan}-${String(i + 1).padStart(2, '0')}`
      const h = peta[tgl]
      return {
        tgl,
        omzet: h?.omzet || 0,
        transaksi: h?.transaksi || 0,
        pengeluaran: pgl[tgl] || 0,
        nanti: tgl > hariIni,
      }
    })
  }, [data, bulan])

  const maks = Math.max(0, ...perHari.map((h) => h.omzet))
  const terbaik = maks > 0 ? perHari.find((h) => h.omzet === maks) : null
  const hDipilih = perHari.find((h) => h.tgl === dipilih)
  const menu = data?.menu || []
  const menuMaks = menu[0]?.qty || 1

  return (
    <div>
      <div className="nav-bulan">
        <button className="chip" onClick={() => setBulan((b) => geserBulan(b, -1))} aria-label="Bulan sebelumnya">‹</button>
        <b>{namaBulan(bulan)}</b>
        <button
          className="chip"
          onClick={() => setBulan((b) => geserBulan(b, 1))}
          disabled={sedangBerjalan}
          aria-label="Bulan berikutnya"
        >
          ›
        </button>
      </div>
      {memuat && <p className="catatan">Memuat…</p>}

      <div className="grid-ringkas">
        <div className="kotak hijau">
          <small>Omzet</small>
          <b>{formatRupiah(r.omzet)}</b>
          <Beda persen={persenBeda(r.omzet, rLalu.omzet)} />
        </div>
        <div className={`kotak ${r.laba >= 0 ? 'biru' : 'merah-muda'}`}>
          <small>Untung Bersih</small>
          <b>{formatRupiah(r.laba)}</b>
          <Beda persen={persenBeda(r.laba, rLalu.laba)} />
        </div>
        <div className="kotak">
          <small>Transaksi</small>
          <b>{r.transaksi}</b>
          <Beda persen={persenBeda(r.transaksi, rLalu.transaksi)} />
        </div>
        <div className="kotak merah-muda">
          <small>Belanja Bahan</small>
          <b>{formatRupiah(r.pengeluaran)}</b>
        </div>
        <div className="kotak">
          <small>💵 Tunai</small>
          <b>{formatRupiah(r.tunai)}</b>
        </div>
        <div className="kotak">
          <small>📱 QRIS</small>
          <b>{formatRupiah(r.qris)}</b>
        </div>
      </div>
      {rLalu.omzet > 0 && <p className="catatan catatan-banding">▲▼ = {labelBanding}</p>}

      <div className="kartu">
        <strong>📈 Omzet per Hari</strong>
        <p className="catatan" style={{ margin: '4px 0 10px' }}>
          {r.hariJualan > 0
            ? `${r.hariJualan} hari berjualan · rata-rata ${formatRupiah(r.omzet / r.hariJualan)}/hari`
            : 'Belum ada penjualan bulan ini.'}
        </p>

        {maks > 0 && (
          <>
            <div className="grafik" role="img" aria-label={`Grafik omzet harian ${namaBulan(bulan)}`}>
              <span className="grafik-maks">{rupiahRingkas(maks)}</span>
              {perHari.map((h) => (
                <button
                  key={h.tgl}
                  className={`grafik-kolom ${dipilih === h.tgl ? 'dipilih' : ''} ${h.nanti ? 'nanti' : ''}`}
                  onClick={() => setDipilih((d) => (d === h.tgl ? null : h.tgl))}
                  disabled={h.nanti}
                  title={`${namaHari(h.tgl)}: ${formatRupiah(h.omzet)}`}
                >
                  {h.omzet > 0 && <span className="grafik-batang" style={{ height: `${(h.omzet / maks) * 100}%` }} />}
                </button>
              ))}
            </div>
            <div className="grafik-sumbu">
              {perHari.map((h, i) => (
                <span key={h.tgl}>{[1, 8, 15, 22, 29].includes(i + 1) ? i + 1 : ''}</span>
              ))}
            </div>

            {hDipilih ? (
              <div className="detail-hari">
                <div>
                  <b>{namaHari(hDipilih.tgl)}</b>
                  <br />
                  <small>
                    {formatRupiah(hDipilih.omzet)} · {hDipilih.transaksi} transaksi
                    {hDipilih.pengeluaran > 0 && ` · belanja ${formatRupiah(hDipilih.pengeluaran)}`}
                  </small>
                </div>
                <button className="btn-utama kecil" onClick={() => onBukaHari(hDipilih.tgl)}>Detail →</button>
              </div>
            ) : (
              <p className="catatan" style={{ marginBottom: 0 }}>
                {terbaik && `🏆 Terbaik: ${namaHari(terbaik.tgl)} (${formatRupiah(terbaik.omzet)}). `}
                Ketuk batang untuk melihat harinya.
              </p>
            )}

            <button className="btn-teks" onClick={() => setTabelBuka((b) => !b)} style={{ marginTop: 6 }}>
              {tabelBuka ? '▲ Tutup tabel' : '📋 Lihat tabel per hari'}
            </button>
            {tabelBuka && (
              <div className="daftar-gulir">
                {perHari
                  .filter((h) => h.omzet > 0 || h.pengeluaran > 0)
                  .map((h) => (
                    <div key={h.tgl} className="baris-item" onClick={() => onBukaHari(h.tgl)} style={{ cursor: 'pointer' }}>
                      <span>
                        <b>{namaHari(h.tgl)}</b>
                        <br />
                        <small>
                          {h.transaksi} transaksi{h.pengeluaran > 0 && ` · belanja ${formatRupiah(h.pengeluaran)}`}
                        </small>
                      </span>
                      <b>{formatRupiah(h.omzet)}</b>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="kartu">
        <strong>🔥 Menu Terlaris Bulan Ini</strong>
        {menu.length === 0 && <p className="catatan">Belum ada penjualan.</p>}
        <div className="daftar-gulir">
          {menu.map((m, i) => (
            <div key={m.nama} className="baris-menu-laris">
              <div className="baris-item" style={{ borderBottom: 0, paddingBottom: 2 }}>
                <span>{i + 1}. {m.nama}</span>
                <span><b>{m.qty}×</b> <small>{formatRupiah(m.nominal)}</small></span>
              </div>
              <div className="batang-laris" style={{ width: `${(m.qty / menuMaks) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
