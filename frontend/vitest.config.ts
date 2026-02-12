import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    css: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/app/router.ts',
        'src/adapters/ApiService.ts',
        'src/controllers/ChatController.ts',
        'src/hooks/useAuth.ts',
        'src/hooks/useChatRoom.ts',
        'src/hooks/useReconnectingWebSocket.ts',
        'src/shared/presence/PresenceProvider.tsx',
      ],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})
