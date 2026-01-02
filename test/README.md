# Test Documentation

## Running Tests

### Unit Tests
Unit tests test individual functions in isolation:
```bash
npm test              # Run all tests
npm run test:unit     # Run only unit tests (excludes integration tests)
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Generate coverage report
```

### Integration Tests
Integration tests simulate full request/response cycles through the worker:
```bash
npm run test:integration  # Run integration tests only
```

**Note:** Integration tests may fail if Vite has issues parsing source files. If you encounter parsing errors, try:
1. Running with `--no-coverage` flag
2. Checking for syntax errors in source files
3. Using `wrangler dev` for manual testing instead

## Test Structure

- `test/cache-ttl.test.js` - Cache TTL calculation tests
- `test/cache-key.test.js` - Cache key generation tests  
- `test/ab-variant.test.js` - A/B variant assignment tests
- `test/device-detection.test.js` - Device detection tests
- `test/integration.test.js` - Full request/response cycle tests

## Mocking

The test setup (`test/setup.js`) mocks Cloudflare Workers APIs:
- `Request`, `Response`, `Headers`, `URL`
- `caches` API
- `fetch` API (for origin requests)

