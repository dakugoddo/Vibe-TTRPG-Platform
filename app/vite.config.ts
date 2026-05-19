import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function manualChunks(id: string) {
  const normalizedId = id.replace(/\\/g, '/')
  if (!normalizedId.includes('/node_modules/')) return undefined

  if (
    normalizedId.includes('/konva/') ||
    normalizedId.includes('/react-konva/') ||
    normalizedId.includes('/react-konva-utils/') ||
    normalizedId.includes('/use-image/')
  ) {
    return 'vendor-canvas'
  }

  if (
    normalizedId.includes('/react-markdown/') ||
    normalizedId.includes('/remark-gfm/') ||
    normalizedId.includes('/unified/') ||
    normalizedId.includes('/remark-') ||
    normalizedId.includes('/rehype-') ||
    normalizedId.includes('/micromark') ||
    normalizedId.includes('/mdast-') ||
    normalizedId.includes('/hast-')
  ) {
    return 'vendor-markdown'
  }

  return 'vendor'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
})
