const path = require('path')

module.exports = {
  rootDir: path.resolve(__dirname, '..', '..'),
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  moduleFileExtensions: ['js', 'json'],
  setupFilesAfterEnv: ['<rootDir>/tests/automated/setup.js'],
  collectCoverageFrom: ['<rootDir>/src/**/*.js'],
  coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],
  transform: {},
}
