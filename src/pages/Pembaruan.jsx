// Popup "Apa yang baru" — dipakai otomatis (pembaruan belum dilihat) dan dari tab Menu (riwayat lengkap)
export default function ModalPembaruan({ daftar, judul = '🎉 Apa yang baru', onTutup }) {
  return (
    <div className="overlay" onClick={onTutup}>
      <div className="modal modal-pembaruan" onClick={(e) => e.stopPropagation()}>
        <div className="modal-judul">
          <span>{judul}</span>
          <button className="btn-teks" onClick={onTutup}>✕</button>
        </div>
        {daftar.map((p) => (
          <div key={p.versi} className="entri-pembaruan">
            <small>
              Versi {p.versi} · {new Date(p.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </small>
            <ul>
              {p.isi.map((baris, i) => (
                <li key={i}>{baris}</li>
              ))}
            </ul>
          </div>
        ))}
        <button className="btn-utama lebar" onClick={onTutup}>
          Oke, mengerti 👍
        </button>
      </div>
    </div>
  )
}
