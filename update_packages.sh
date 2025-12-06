#!/bin/bash
set -euo pipefail

# Update backend/package.json - add test scripts after loadtest
sed -i '11a\    "test": "jest",\n    "test:watch": "jest --watch",\n    "test:coverage": "jest --coverage",' backend/package.json

# Update backend/package.json - add test dependencies after ts-node
sed -i '31a\    "jest": "^29.7.0",\n    "@types/jest": "^29.5.11",\n    "ts-jest": "^29.1.1"' backend/package.json

# Update frontend/package.json - add test scripts after lint
sed -i '9a\    "test": "jest",\n    "test:watch": "jest --watch",\n    "test:coverage": "jest --coverage",' frontend/package.json

# Update frontend/package.json - add test dependencies after tailwindcss
sed -i '25a\    "jest": "^29.7.0",\n    "@types/jest": "^29.5.11",\n    "jest-environment-jsdom": "^29.7.0"' frontend/package.json

# Update payment/package.json - add test scripts after dev
sed -i '9a\    "test": "jest",\n    "test:watch": "jest --watch",\n    "test:coverage": "jest --coverage",' payment/package.json

# Update payment/package.json - add test dependencies after ts-node
sed -i '27a\    "jest": "^29.7.0",\n    "@types/jest": "^29.5.11",\n    "ts-jest": "^29.1.1"' payment/package.json

# Update clickhouse-bridge/package.json - add test scripts after start
sed -i '7a\    "test": "jest",\n    "test:watch": "jest --watch",\n    "test:coverage": "jest --coverage",' clickhouse-bridge/package.json

# Update clickhouse-bridge/package.json - add devDependencies section
sed -i '13a\  },\n  "devDependencies": {\n    "jest": "^29.7.0"' clickhouse-bridge/package.json

echo "✓ All package.json files updated"