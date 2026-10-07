import { defineConfig } from 'vite'
import { avatarkitVitePlugin } from '@spatius/avatarkit/vite'

export default defineConfig({
  base: './',
  // Spatius' plugin serves/copies the AvatarKit .wasm files correctly.
  plugins: [avatarkitVitePlugin()],
  // Force one shared copy so AvatarSDK.initialize() is seen by avatarkit-rtc.
  resolve: { dedupe: ['@spatius/avatarkit', 'livekit-client'] },
  optimizeDeps: { include: ['@spatius/avatarkit', '@spatius/avatarkit-rtc'] },
  server: { port: 5199, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 4000 },
})
