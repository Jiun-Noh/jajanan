import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ID unik tiap build. Ditanam di aplikasi DAN ditulis ke /versi.json, supaya aplikasi yang
// sedang terbuka bisa tahu kalau sudah ada versi baru di server (lihat src/lib/versiBaru.js).
const BUILD_ID = Date.now().toString(36)

function tulisVersiJson() {
  return {
    name: 'tulis-versi-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'versi.json', source: JSON.stringify({ build: BUILD_ID }) })
    },
  }
}

export default defineConfig({
  plugins: [react(), tulisVersiJson()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  server: { port: 5180 },
})
