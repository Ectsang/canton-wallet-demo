import { Buffer } from 'buffer';
import { vi } from 'vitest';

// Make Buffer available globally for tests (Node.js environment)
global.Buffer = Buffer;
// No window manipulation needed in Node.js environment

// Mock console methods to reduce noise in tests (but allow some output for debugging)
global.console = {
  ...console,
  log: process.env.DEBUG_TESTS ? console.log : vi.fn(),
  debug: process.env.DEBUG_TESTS ? console.debug : vi.fn(),
  info: console.info, // Keep info for important integration test output
  warn: console.warn, // Keep warnings
  error: console.error, // Keep errors
};

// Setup crypto for Node.js environment
if (!global.crypto) {
  global.crypto = {
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  };
}

// NO MOCKING - Integration tests use real Canton SDK
