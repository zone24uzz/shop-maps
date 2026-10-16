// Imported first by every test file, before any application module.
// With NODE_ENV=test the app skips loading backend/.env (see src/config/env.js)
// and the logger stays quiet, so tests are independent of local settings.
process.env.NODE_ENV = 'test';
