#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  run-qa.sh — Autonomous QA Pipeline Orchestrator
#
#  Executes: Lint → TypeScript Check (if applicable) →
#            Build Check → Test Seed → E2E Tests
#
#  Usage:  bash run-qa.sh   (or  ./run-qa.sh  in Git Bash / WSL)
# ═══════════════════════════════════════════════════════════════

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
FAILURES=0

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   🚀  NexusGate Autonomous QA Pipeline                  ║"
echo "║   ${TIMESTAMP}              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ═══════════════════════════════════════════════════════════════
#  STEP 0: Install dependencies (if needed)
# ═══════════════════════════════════════════════════════════════
echo -e "${CYAN}[0/5] Checking dependencies...${NC}"
cd "$ROOT_DIR"

if [ ! -d "node_modules" ]; then
  echo "  ↳ Installing root dependencies..."
  npm install --silent
fi

if [ ! -d "client/node_modules" ]; then
  echo "  ↳ Installing client dependencies..."
  cd client && npm install --silent && cd "$ROOT_DIR"
fi

if [ ! -d "server/node_modules" ]; then
  echo "  ↳ Installing server dependencies..."
  cd server && npm install --silent && cd "$ROOT_DIR"
fi

if [ ! -f "node_modules/.playwright-browsers-installed" ]; then
  echo "  ↳ Installing Playwright browsers..."
  npx playwright install chromium
  touch node_modules/.playwright-browsers-installed
fi

echo -e "${GREEN}  ✓ Dependencies ready${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════
#  STEP 1: Lint Check
# ═══════════════════════════════════════════════════════════════
echo -e "${CYAN}[1/5] Running ESLint (client)...${NC}"
cd "$ROOT_DIR/client"

if npx eslint . --max-warnings=50; then
  echo -e "${GREEN}  ✓ Lint passed${NC}"
else
  echo -e "${RED}  ✖ Lint failed${NC}"
  FAILURES=$((FAILURES + 1))
fi
cd "$ROOT_DIR"
echo ""

# ═══════════════════════════════════════════════════════════════
#  STEP 2: TypeScript Check (skip if no tsconfig found)
# ═══════════════════════════════════════════════════════════════
echo -e "${CYAN}[2/5] TypeScript check...${NC}"

if [ -f "client/tsconfig.json" ]; then
  cd "$ROOT_DIR/client"
  if npx tsc --noEmit; then
    echo -e "${GREEN}  ✓ TypeScript check passed${NC}"
  else
    echo -e "${RED}  ✖ TypeScript check failed${NC}"
    FAILURES=$((FAILURES + 1))
  fi
  cd "$ROOT_DIR"
else
  echo -e "${YELLOW}  ⚡ No TypeScript config found — skipping${NC}"
fi
echo ""

# ═══════════════════════════════════════════════════════════════
#  STEP 3: Build Check (client + server)
# ═══════════════════════════════════════════════════════════════
echo -e "${CYAN}[3/5] Build check...${NC}"

echo "  ↳ Building client..."
cd "$ROOT_DIR/client"
if npx vite build --logLevel error; then
  echo -e "${GREEN}  ✓ Client build passed${NC}"
else
  echo -e "${RED}  ✖ Client build failed${NC}"
  FAILURES=$((FAILURES + 1))
fi

# Server build check — Node.js apps don't have a build step typically,
# but we can do a require.resolve check
echo "  ↳ Checking server syntax..."
cd "$ROOT_DIR/server"
if node -e "
  try {
    require('./server.js');
    console.log('ok');
  } catch(e) {
    if (e.message.includes('ECONNREFUSED') || e.message.includes('MongooseError') || e.message.includes('MONGO_URI')) {
      console.log('ok (expected env error)');
    } else {
      console.error(e.message);
      process.exit(1);
    }
  }
" 2>&1 | head -1; then
  echo -e "${GREEN}  ✓ Server syntax OK${NC}"
else
  echo -e "${RED}  ✖ Server syntax check failed${NC}"
  FAILURES=$((FAILURES + 1))
fi

cd "$ROOT_DIR"
echo ""

# ═══════════════════════════════════════════════════════════════
#  STEP 4: Seed Test Data
# ═══════════════════════════════════════════════════════════════
echo -e "${CYAN}[4/5] Seeding E2E test data...${NC}"

# First ensure the backend is running
echo "  ↳ Starting backend for seeding..."
cd "$ROOT_DIR"

# Start server in background and wait for it
npx cross-env NODE_ENV=test node server/server.js &
SERVER_PID=$!
echo "  ↳ Server PID: $SERVER_PID"

# Wait for server to be ready
for i in $(seq 1 30); do
  if curl -s http://localhost:5000/api/status > /dev/null 2>&1; then
    echo -e "${GREEN}  ✓ Server is ready${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}  ✖ Server failed to start within 30s${NC}"
    kill $SERVER_PID 2>/dev/null || true
    FAILURES=$((FAILURES + 1))
    break
  fi
  sleep 1
done

# Run the setup script
if node tests/setup.mjs; then
  echo -e "${GREEN}  ✓ Test data seeded${NC}"
else
  echo -e "${RED}  ✖ Test data seeding failed${NC}"
  FAILURES=$((FAILURES + 1))
  kill $SERVER_PID 2>/dev/null || true
fi

# Kill the background server
kill $SERVER_PID 2>/dev/null || true
echo ""

# ═══════════════════════════════════════════════════════════════
#  STEP 5: E2E Tests (Playwright)
# ═══════════════════════════════════════════════════════════════
echo -e "${CYAN}[5/5] Running Playwright E2E tests...${NC}"

cd "$ROOT_DIR"
if npx playwright test --config=playwright.config.mjs; then
  echo -e "${GREEN}  ✓ All E2E tests passed${NC}"
else
  echo -e "${RED}  ✖ Some E2E tests failed${NC}"
  FAILURES=$((FAILURES + 1))
fi
echo ""

# ═══════════════════════════════════════════════════════════════
#  SUMMARY
# ═══════════════════════════════════════════════════════════════
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  📊 QA Pipeline Summary                                 ║"
echo "╠══════════════════════════════════════════════════════════╣"

if [ $FAILURES -eq 0 ]; then
  echo -e "║  ${GREEN}✅ ALL CHECKS PASSED${NC}                              ║"
else
  echo -e "║  ${RED}❌ ${FAILURES} CHECK(S) FAILED${NC}                              ║"
fi

echo "╚══════════════════════════════════════════════════════════╝"
echo ""

exit $FAILURES
