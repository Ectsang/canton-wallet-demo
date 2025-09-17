import '@testing-library/jest-dom';
import { Buffer } from 'buffer';
import { vi } from 'vitest';

// Make Buffer available globally for tests
global.Buffer = Buffer;
window.Buffer = Buffer;

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Setup for Canton SDK mocks
if (!window.crypto) {
  Object.defineProperty(window, 'crypto', {
    value: {
      getRandomValues: (arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
    },
    writable: true,
  });
}
