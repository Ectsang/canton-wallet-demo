/**
 * Mock authentication controller for integration tests
 * This bypasses the JWT token creation issues in the Canton SDK
 */
export class MockAuthController {
  constructor(logger) {
    this.logger = logger;
    this.userId = `test-user-${Date.now()}`;
  }

  async getUserToken() {
    // Return a mock user token for testing
    return {
      userId: this.userId,
      accessToken: `mock-token-${Math.random().toString(36).substring(7)}`
    };
  }

  async getAdminToken() {
    // Return a mock admin token for testing
    return {
      userId: this.userId,
      accessToken: `mock-admin-token-${Math.random().toString(36).substring(7)}`
    };
  }
}

export const createMockAuthFactory = (logger) => {
  return new MockAuthController(logger);
};
