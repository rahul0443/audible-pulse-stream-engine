module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageThreshold: {
    global: {
      // Branches sits at ~68-69% with a real Postgres+Redis available (lower given
      // neither, per the fallback design). The uncovered branches are mainly
      // rateLimiter.ts's 429-exceeded and fail-open-on-error paths, which aren't
      // exercised by the current suite. Set just below current reality rather than
      // above it -- raise this as tests for those paths are added, don't just bump
      // the number.
      branches: 65,
      functions: 70,
      lines: 75,
      statements: 75,
    },
  },
};
