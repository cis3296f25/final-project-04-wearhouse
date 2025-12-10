module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'index.js',
    '!**/node_modules/**'
  ],
  coverageReporters: ['text', 'json', 'html'],
  verbose: true
};

