module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  moduleNameMapper: {
    '^/opt/nodejs/(.*)$': '<rootDir>/src/layers/nodejs/$1'
  },
  moduleDirectories: ['node_modules', 'src/layers/nodejs'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/src/layers/nodejs/data/'
  ]
};
