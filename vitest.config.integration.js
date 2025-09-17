import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: './src/test/setup/integration.setup.js',
    include: [
      'src/test/integration/**/*.{test,spec}.{js,jsx,ts,tsx}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/src/test/unit/**', // Exclude unit tests
    ],
    testTimeout: 30000, // Longer timeout for integration tests
    hookTimeout: 30000,
  },
})