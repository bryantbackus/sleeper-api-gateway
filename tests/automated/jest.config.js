const path = require('path')

module.exports = {
  rootDir: path.resolve(__dirname, '..', '..'),
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  moduleFileExtensions: ['js', 'json'],
  collectCoverageFrom: ['<rootDir>/src/**/*.js'],
  coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],
  transform: {},
}
