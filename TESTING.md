# Testing Documentation

This document describes the comprehensive test suite for the postgres-to-clickhouse project.

## Overview

The project now includes extensive unit tests for all services:
- **Backend Service**: Order management, authentication, tracing
- **Frontend Service**: Client-side tracing utilities
- **Payment Service**: Payment processing, authentication, tracing
- **ClickHouse Bridge**: Kafka-to-ClickHouse synchronization

## Test Framework

All services use **Jest** as the testing framework:
- TypeScript services (backend, frontend, payment): `ts-jest` preset
- JavaScript services (clickhouse-bridge): Native Jest

## Running Tests

### Backend Tests
```bash
cd backend
npm install
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Generate coverage report
```

### Frontend Tests
```bash
cd frontend
npm install
npm test
npm run test:watch
npm run test:coverage
```

### Payment Service Tests
```bash
cd payment
npm install
npm test
npm run test:watch
npm run test:coverage
```

### ClickHouse Bridge Tests
```bash
cd clickhouse-bridge
npm install
npm test
npm run test:watch
npm run test:coverage
```

### Run All Tests
```bash
# From project root
for dir in backend frontend payment clickhouse-bridge; do
    echo "Testing $dir..."
    cd $dir && npm test && cd ..
done
```

## Test Coverage

### Backend Service
- **Auth Middleware** (`middleware/auth.test.ts`): 15+ test cases
  - Token validation (valid/invalid/expired)
  - Authorization header parsing
  - Token generation with various parameters
  - Edge cases (malformed tokens, wrong secrets)

- **Tracing Utils** (`utils/tracing.test.ts`): 40+ test cases
  - UUID generation and validation
  - Trace header parsing
  - OpenTelemetry span creation
  - Duration calculations
  - Status code mapping
  - Metadata handling

- **Order Service** (`services/orderService.test.ts`): 20+ test cases
  - Order creation (happy path and edge cases)
  - Transaction management (commit/rollback)
  - User upsert logic
  - Order retrieval
  - Error handling
  - Special characters and large values

### Frontend Service
- **Tracing Library** (`lib/tracing.test.ts`): 25+ test cases
  - UUID generation (browser native and fallback)
  - Trace header parsing
  - Browser compatibility (with/without crypto API)
  - Edge cases and special characters

### Payment Service
- **Auth Middleware** (`middleware/auth.test.ts`): 15+ test cases
  - Same comprehensive coverage as backend auth
  - Payment-specific scenarios

- **Tracing Utils** (`utils/tracing.test.ts`): 35+ test cases
  - Payment service specific tracing
  - Full OpenTelemetry span coverage
  - Payment operation tracking

### ClickHouse Bridge
- **Main Module** (`__tests__/index.test.js`): 40+ test cases
  - Kafka consumer initialization
  - CDC event processing (CREATE/READ/UPDATE/DELETE)
  - Data transformations (base64 decoding, timestamp conversion)
  - ClickHouse HTTP API integration
  - Error handling
  - SQL injection prevention
  - Environment configuration

## Test Patterns

### Mocking
- Database connections are mocked using Jest mocks
- External services (Kafka, ClickHouse, Axios) are mocked
- Crypto APIs are mocked for cross-environment testing

### Test Structure
Each test file follows AAA pattern:
- **Arrange**: Setup test data and mocks
- **Act**: Execute the function under test
- **Assert**: Verify expected outcomes

### Coverage Goals
- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

## Continuous Integration

To integrate with CI/CD:

```yaml
# Example GitHub Actions workflow
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-node@v2
      with:
        node-version: '20'
    - name: Test Backend
      run: cd backend && npm ci && npm test
    - name: Test Frontend
      run: cd frontend && npm ci && npm test
    - name: Test Payment
      run: cd payment && npm ci && npm test
    - name: Test Bridge
      run: cd clickhouse-bridge && npm ci && npm test
```

## Best Practices

1. **Isolation**: Each test is independent and doesn't rely on others
2. **Mocking**: External dependencies are always mocked
3. **Clarity**: Test names clearly describe what is being tested
4. **Coverage**: Both happy paths and edge cases are covered
5. **Speed**: Tests run quickly without real database/network calls

## Troubleshooting

### Common Issues

**Issue**: Tests fail with "Cannot find module"
**Solution**: Run `npm install` in the service directory

**Issue**: TypeScript compilation errors
**Solution**: Ensure `tsconfig.json` and `jest.config.js` are properly configured

**Issue**: Mock not working
**Solution**: Ensure mocks are defined before imports using `jest.mock()`

**Issue**: Timeout errors
**Solution**: Increase Jest timeout or fix async/await handling

## Contributing

When adding new code:
1. Write tests first (TDD approach recommended)
2. Ensure all tests pass before committing
3. Maintain > 80% code coverage
4. Follow existing test patterns
5. Add edge cases and error scenarios
