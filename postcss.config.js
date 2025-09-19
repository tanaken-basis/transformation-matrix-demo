// postcss.config.js (ESM)
import tailwind from '@tailwindcss/postcss'
import autoprefixer from 'autoprefixer'

export default {
  plugins: [
    tailwind(),       // ← ここが v4 では必須（旧 'tailwindcss' ではなく '@tailwindcss/postcss'）
    autoprefixer()
  ]
}
