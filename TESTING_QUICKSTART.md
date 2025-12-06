# Testing Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Install Dependencies
```bash
# Install test dependencies for all services
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd payment && npm install && cd ..
cd clickhouse-bridge && npm install && cd ..
```

### Step 2: Run Tests
```bash
# Run all tests
cd backend && npm test && cd ..
cd frontend && npm test && cd ..
cd payment && npm test && cd ..
cd clickhouse-bridge && npm test && cd ..
```

### Step 3: View Coverage
```bash
# Generate coverage reports
cd backend && npm run test:coverage
# Open: backend/coverage/lcov-report/index.html in browser
```

## 📊 What's Included

- ✅ **200+ Test Cases** across all services
- ✅ **4 Jest Configurations** optimized for each service
- ✅ **High Coverage** targeting 80%+ code coverage
- ✅ **Comprehensive Mocking** for databases and external services
- ✅ **CI/CD Ready** with coverage reporting

## 🧪 Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode (auto-rerun on changes) |
| `npm run test:coverage` | Run tests with coverage report |

## 📁 Test Structure