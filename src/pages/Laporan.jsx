import { useEffect, useMemo, useRef, useState } from 'react'
import { formatRupiah, tanggalLokal } from '../lib/format'
import * as db from '../lib/penyimpanan'
import { KATEGORI_BELANJA, infoKategori } from '../lib/kategori'
import PeringkatMenu from './PeringkatMenu'

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
  const pengeluaran = pgl.reduce((s, p) => s + p.nominal, 0) // operasional (tanpa peralatan)
  const modal = pgl.reduce((s, p) => s + (p.modal || 0), 0)
  return {
    modal,
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
  const iDipilih = perHari.findIndex((h) => h.tgl === dipilih)
  const hDipilih = perHari[iDipilih]
  // hari terakhir yang boleh dipilih (bulan berjalan: sampai hari ini)
  const iTerakhir = perHari.reduce((akhir, h, i) => (h.nanti ? akhir : i), -1)

  // Geser jari di atas grafik → hari di bawah jari langsung terpilih (tidak perlu kena batang yang kecil)
  const grafikRef = useRef(null)
  const sedangGeser = useRef(false)
  function pilihDariX(clientX) {
    const el = grafikRef.current
    if (!el || iTerakhir < 0) return
    const { left, width } = el.getBoundingClientRect()
    const i = Math.floor(((clientX - left) / width) * perHari.length)
    setDipilih(perHari[Math.max(0, Math.min(iTerakhir, i))].tgl)
  }
  const geser = {
    onPointerDown: (e) => {
      sedangGeser.current = true
      e.currentTarget.setPointerCapture?.(e.pointerId)
      pilihDariX(e.clientX)
    },
    onPointerMove: (e) => sedangGeser.current && pilihDariX(e.clientX),
    onPointerUp: () => (sedangGeser.current = false),
    onPointerCancel: () => (sedangGeser.current = false), // jari bergerak vertikal → halaman yang digulir
  }
  const pindahHari = (arah) => {
    const i = iDipilih + arah
    if (i >= 0 && i <= iTerakhir) setDipilih(perHari[i].tgl)
  }
  const menu = data?.menu || []

  // Biaya per kategori (operasional saja) & rasio biaya bahan terhadap omzet
  const perKategori = KATEGORI_BELANJA.filter((k) => !k.modal)
    .map((k) => ({ ...k, nominal: (data?.kategori || []).find((x) => x.kategori === k.id)?.nominal || 0 }))
    .filter((k) => k.nominal > 0)
  const kategoriMaks = Math.max(1, ...perKategori.map((k) => k.nominal))
  const biayaBahan = perKategori.filter((k) => ['Bahan', 'Bumbu', 'Kemasan'].includes(k.id)).reduce((s, k) => s + k.nominal, 0)

  // Balik modal: untung (tanpa modal) sejak awal ÷ total modal peralatan
  const sp = data?.sepanjang || { omzet: 0, operasional: 0, modal: 0 }
  const untungSepanjang = sp.omzet - sp.operasional
  const persenBalik = sp.modal > 0 ? Math.max(0, Math.min(100, Math.round((untungSepanjang / sp.modal) * 100))) : 0

  const barang = data?.barang || []
  const [barangDipilih, setBarangDipilih] = useState(null)
  const [rincianModalBuka, setRincianModalBuka] = useState(false)
  // rata-rata untung per hari berjualan bulan ini → dasar perkiraan balik modal
  const untungPerHari = r.hariJualan > 0 ? r.laba / r.hariJualan : null

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
          <small>Biaya Operasional</small>
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
      <p className="catatan catatan-banding">Untung Bersih = Omzet − Biaya Operasional (peralatan/modal tidak dihitung).</p>

      {sp.modal > 0 && (
        <div className="kartu kartu-ketuk" onClick={() => setRincianModalBuka(true)} role="button">
          <strong>🛠️ Balik Modal</strong>
          <small className="tautan-rincian">Ketuk untuk rincian →</small>
          <p className="catatan" style={{ margin: '4px 0 10px' }}>
            Untung yang sudah terkumpul dibanding uang yang dipakai beli peralatan{sedangBerjalan ? ' (sampai hari ini)' : ` (sampai akhir ${namaBulan(bulan, { month: 'long' })})`}.
          </p>
          <div className="meter-balik" role="img" aria-label={`Balik modal ${persenBalik} persen`}>
            <span style={{ width: `${persenBalik}%` }} />
          </div>
          <div className="baris-balik">
            <b>{persenBalik}% kembali</b>
            <small>
              {untungSepanjang >= sp.modal
                ? `✅ Sudah balik modal! Lebih ${formatRupiah(untungSepanjang - sp.modal)}`
                : `Sisa ${formatRupiah(sp.modal - Math.max(0, untungSepanjang))}`}
            </small>
          </div>
          <div className="baris-item">
            <span><small>Modal peralatan</small></span>
            <b>{formatRupiah(sp.modal)}</b>
          </div>
          <div className="baris-item">
            <span><small>Untung terkumpul</small></span>
            <b>{formatRupiah(untungSepanjang)}</b>
          </div>
          {r.modal > 0 && (
            <div className="baris-item">
              <span><small>Beli peralatan bulan ini</small></span>
              <b>{formatRupiah(r.modal)}</b>
            </div>
          )}
        </div>
      )}

      <div className="kartu">
        <strong>📈 Omzet per Hari</strong>
        <p className="catatan" style={{ margin: '4px 0 10px' }}>
          {r.hariJualan > 0
            ? `${r.hariJualan} hari berjualan · rata-rata ${formatRupiah(r.omzet / r.hariJualan)}/hari`
            : 'Belum ada penjualan bulan ini.'}
        </p>

        {maks > 0 && (
          <>
            <div
              ref={grafikRef}
              className="grafik"
              role="img"
              aria-label={`Grafik omzet harian ${namaBulan(bulan)}`}
              {...geser}
            >
              <span className="grafik-maks">{rupiahRingkas(maks)}</span>
              {hDipilih && (
                <span className="grafik-label" style={{ left: `${((iDipilih + 0.5) / perHari.length) * 100}%` }}>
                  {iDipilih + 1}
                </span>
              )}
              {perHari.map((h) => (
                <span
                  key={h.tgl}
                  className={`grafik-kolom ${dipilih === h.tgl ? 'dipilih' : ''} ${h.nanti ? 'nanti' : ''}`}
                  title={`${namaHari(h.tgl)}: ${formatRupiah(h.omzet)}`}
                >
                  {h.omzet > 0 && <span className="grafik-batang" style={{ height: `${(h.omzet / maks) * 100}%` }} />}
                </span>
              ))}
            </div>
            <div className="grafik-sumbu">
              {perHari.map((h, i) => (
                <span key={h.tgl}>{[1, 8, 15, 22, 29].includes(i + 1) ? i + 1 : ''}</span>
              ))}
            </div>

            {hDipilih ? (
              <div className="detail-hari">
                <button className="btn-geser-hari" onClick={() => pindahHari(-1)} disabled={iDipilih <= 0} aria-label="Hari sebelumnya">‹</button>
                <div className="isi-detail-hari">
                  <b>{namaHari(hDipilih.tgl)}</b>
                  <br />
                  <small>
                    {hDipilih.omzet > 0 ? `${formatRupiah(hDipilih.omzet)} · ${hDipilih.transaksi} transaksi` : 'Tidak ada penjualan'}
                    {hDipilih.pengeluaran > 0 && ` · belanja ${formatRupiah(hDipilih.pengeluaran)}`}
                  </small>
                  <br />
                  <button className="btn-teks" onClick={() => onBukaHari(hDipilih.tgl)} style={{ padding: '4px 0 0' }}>Lihat detail hari ini →</button>
                </div>
                <button className="btn-geser-hari" onClick={() => pindahHari(1)} disabled={iDipilih >= iTerakhir} aria-label="Hari berikutnya">›</button>
              </div>
            ) : (
              <p className="catatan" style={{ marginBottom: 0 }}>
                {terbaik && `🏆 Terbaik: ${namaHari(terbaik.tgl)} (${formatRupiah(terbaik.omzet)}). `}
                👆 Sentuh atau geser jari di grafik untuk melihat tiap hari.
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
        <strong>🧺 Biaya Operasional per Kategori</strong>
        {perKategori.length === 0 && <p className="catatan">Belum ada belanja bulan ini.</p>}
        {perKategori.map((k) => (
          <div key={k.id} className="baris-menu-laris">
            <div className="baris-item" style={{ borderBottom: 0, paddingBottom: 2 }}>
              <span>{k.ikon} {k.label}</span>
              <span>
                <b>{formatRupiah(k.nominal)}</b> <small>{Math.round((k.nominal / Math.max(1, r.pengeluaran)) * 100)}%</small>
              </span>
            </div>
            <div className="batang-laris" style={{ width: `${(k.nominal / kategoriMaks) * 100}%` }} />
          </div>
        ))}
        {r.omzet > 0 && biayaBahan > 0 && (
          <p className="catatan" style={{ marginBottom: 0 }}>
            🥩 Biaya bahan + bumbu + kemasan = <b>{Math.round((biayaBahan / r.omzet) * 100)}%</b> dari omzet
            {' '}(dari Rp 10.000 penjualan, ±{formatRupiah((biayaBahan / r.omzet) * 10000)} untuk bahan).
          </p>
        )}
      </div>

      <div className="kartu">
        <strong>🛒 Barang Paling Banyak Dibeli</strong>
        {barang.length === 0 && <p className="catatan">Belum ada belanja bulan ini.</p>}
        {barang.length > 0 && <small className="label-kecil">Urut dari total uang terbesar · ketuk untuk lihat riwayat harga</small>}
        <div className="daftar-gulir">
          {barang.map((b) => (
            <div key={b.nama} className="baris-item" onClick={() => setBarangDipilih(b)} style={{ cursor: 'pointer' }}>
              <span>
                {infoKategori(b.kategori).ikon} {b.nama}
                <br />
                <small>
                  {b.kali}× beli{b.kali > 1 && ` · rata-rata ${formatRupiah(b.rata)}`}
                  {b.termurah !== b.termahal && ` · ${formatRupiah(b.termurah)}–${formatRupiah(b.termahal)}`}
                </small>
              </span>
              <b>{formatRupiah(b.total)}</b>
            </div>
          ))}
        </div>
      </div>

      {rincianModalBuka && (
        <ModalBalikModal
          sp={sp}
          akhir={`${geserBulan(bulan, 1)}-01`}
          persen={persenBalik}
          untungPerHari={sedangBerjalan ? untungPerHari : null}
          hariJualan={r.hariJualan}
          labelSampai={sedangBerjalan ? 'sampai hari ini' : `sampai akhir ${namaBulan(bulan, { month: 'long' })}`}
          onTutup={() => setRincianModalBuka(false)}
          notify={notify}
        />
      )}

      {barangDipilih && <ModalRiwayat barang={barangDipilih} onTutup={() => setBarangDipilih(null)} notify={notify} />}

      <div className="kartu">
        <strong>🔥 Menu Terlaris Bulan Ini</strong>
        <PeringkatMenu key={bulan} daftar={menu} batang />
      </div>
    </div>
  )
}

// Riwayat harga satu barang (semua bulan), terbaru di atas, dengan naik/turun dari pembelian sebelumnya
function ModalRiwayat({ barang, onTutup, notify }) {
  const [riwayat, setRiwayat] = useState(null)

  useEffect(() => {
    db.ambilRiwayatBarang(barang.nama)
      .then(setRiwayat)
      .catch((e) => {
        notify(`⚠️ Gagal memuat riwayat: ${e.message}`)
        onTutup()
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barang.nama]) // muat sekali per barang (onTutup/notify tidak perlu memicu muat ulang)

  return (
    <div className="overlay" onClick={onTutup}>
      <div className="modal modal-pembaruan" onClick={(e) => e.stopPropagation()}>
        <div className="modal-judul">
          <span>
            {infoKategori(barang.kategori).ikon} {barang.nama}
          </span>
          <button className="btn-teks" onClick={onTutup}>✕</button>
        </div>
        {!riwayat && <p className="catatan">Memuat…</p>}
        {riwayat && (
          <>
            <p className="catatan" style={{ marginTop: 0 }}>
              Dibeli {riwayat.length}× · total {formatRupiah(riwayat.reduce((s, x) => s + x.nominal, 0))}
            </p>
            {riwayat.map((x, i) => {
              const sebelum = riwayat[i + 1]?.nominal
              const beda = sebelum ? x.nominal - sebelum : 0
              return (
                <div key={x.id} className="baris-item">
                  <span>{namaHari(x.tanggal)}</span>
                  <span>
                    <b>{formatRupiah(x.nominal)}</b>{' '}
                    {beda !== 0 && (
                      <small className={`beda ${beda > 0 ? 'turun' : 'naik'}`}>
                        {beda > 0 ? '▲' : '▼'} {formatRupiah(Math.abs(beda))}
                      </small>
                    )}
                  </span>
                </div>
              )
            })}
            <p className="catatan">▲ merah = lebih mahal dari pembelian sebelumnya, ▼ hijau = lebih murah.</p>
          </>
        )}
      </div>
    </div>
  )
}

// Rincian "Balik Modal": daftar peralatan, hitungan untung, dan perkiraan kapan modal kembali
function ModalBalikModal({ sp, akhir, persen, untungPerHari, hariJualan, labelSampai, onTutup, notify }) {
  const [alat, setAlat] = useState(null)

  useEffect(() => {
    db.ambilPeralatan(akhir)
      .then(setAlat)
      .catch((e) => {
        notify(`⚠️ Gagal memuat rincian: ${e.message}`)
        onTutup()
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [akhir])

  const untung = sp.omzet - sp.operasional
  const sisa = sp.modal - untung
  const sudah = sisa <= 0

  let perkiraan = null
  if (!sudah && untungPerHari !== null) {
    perkiraan =
      untungPerHari > 0
        ? `Dengan rata-rata untung ${formatRupiah(untungPerHari)} per hari jualan bulan ini, modal diperkirakan kembali dalam ±${Math.ceil(sisa / untungPerHari)} hari jualan lagi.`
        : 'Belum bisa diperkirakan — untung harian bulan ini masih minus. Biasanya membaik setelah stok awal habis terpakai.'
  }

  return (
    <div className="overlay" onClick={onTutup}>
      <div className="modal modal-pembaruan" onClick={(e) => e.stopPropagation()}>
        <div className="modal-judul">
          <span>🛠️ Rincian Balik Modal</span>
          <button className="btn-teks" onClick={onTutup}>✕</button>
        </div>
        <p className="catatan" style={{ marginTop: 4 }}>Dihitung sejak awal berjualan, {labelSampai}.</p>

        <div className="meter-balik" role="img" aria-label={`Balik modal ${persen} persen`}>
          <span style={{ width: `${persen}%` }} />
        </div>
        <div className="baris-balik">
          <b>{persen}% kembali</b>
          <small>{sudah ? `✅ Lebih ${formatRupiah(-sisa)}` : `Sisa ${formatRupiah(sisa)}`}</small>
        </div>

        <strong className="sub-judul">💰 Untung terkumpul</strong>
        <div className="baris-item">
          <span><small>Total omzet</small></span>
          <span>{formatRupiah(sp.omzet)}</span>
        </div>
        <div className="baris-item">
          <span><small>− Biaya operasional (bahan, bumbu, kemasan, gas, lain-lain)</small></span>
          <span>{formatRupiah(sp.operasional)}</span>
        </div>
        <div className="baris-item">
          <span><b>= Untung terkumpul</b></span>
          <b className={untung < 0 ? 'teks-merah' : ''}>{formatRupiah(untung)}</b>
        </div>

        {perkiraan && (
          <div className="kotak-perkiraan">
            📅 {perkiraan}
            {untungPerHari > 0 && hariJualan < 7 && (
              <small> (Masih perkiraan kasar — baru {hariJualan} hari jualan bulan ini.)</small>
            )}
          </div>
        )}

        <strong className="sub-judul">🛠️ Modal peralatan {alat && `(${alat.length})`}</strong>
        {!alat && <p className="catatan">Memuat…</p>}
        {/* daftar digulir di dalam kotak, baris "Total modal" tetap terlihat di bawahnya */}
        {alat && (
          <div className="daftar-gulir daftar-alat">
            {alat.map((a) => (
              <div key={a.id} className="baris-item">
                <span>
                  {a.deskripsi}
                  <br />
                  <small>{namaHari(a.tanggal)}</small>
                </span>
                <span>{formatRupiah(a.nominal)}</span>
              </div>
            ))}
          </div>
        )}
        {alat && (
          <div className="baris-item baris-total-alat">
            <span><b>Total modal</b></span>
            <b>{formatRupiah(alat.reduce((s, a) => s + a.nominal, 0))}</b>
          </div>
        )}
        <p className="catatan">ⓘ Ada yang salah kategori? Ubah di tab Penjualan (pilih tanggalnya → ketuk barangnya).</p>
      </div>
    </div>
  )
}
