import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useRuntimeMock = env.VITE_RUNTIME_MOCK_SDK === 'true'

  return {
    plugins: [react()],
    define: {
      global: 'globalThis',
      'process.env': {},
    },
    resolve: {
      alias: {
        buffer: 'buffer',
        ...(useRuntimeMock ? { '@canton-network/wallet-sdk': '/src/runtime/walletSDK.runtime.js' } : {}),
      },
    },
    optimizeDeps: {
      include: ['buffer'],
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.browser.js',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/src/test/realIntegration.test.js', // Exclude real integration tests from regular runs
      ],
      coverage: {
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/test/',
        ],
      },
    },
  }
})