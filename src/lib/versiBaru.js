import { useEffect, useState } from 'react'

// Cek tiap beberapa menit (dan saat aplikasi dibuka lagi) apakah server sudah punya build baru.
// Di mode dev tidak ada versi.json → tidak pernah muncul.
const JEDA_CEK = 5 * 60 * 1000

export function useAdaVersiBaru() {
  const [ada, setAda] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV) return
    let batal = false

    async function cek() {
      try {
        const r = await fetch(`/versi.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!r.ok) return
        const { build } = await r.json()
        if (!batal && build && build !== __BUILD_ID__) setAda(true)
      } catch {
        // offline — coba lagi nanti
      }
    }

    const saatTerlihat = () => document.visibilityState === 'visible' && cek()
    cek()
    const id = setInterval(cek, JEDA_CEK)
    document.addEventListener('visibilitychange', saatTerlihat)
    return () => {
      batal = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', saatTerlihat)
    }
  }, [])

  return ada
}
