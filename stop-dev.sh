#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${RED}🛑 Stopping 6Soft HRM Development Environment${NC}"
echo ""

# Kill processes on ports
echo -e "${RED}🔪 Killing processes on ports 4000, 5173-5175...${NC}"
lsof -ti:4000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
lsof -ti:5174 | xargs kill -9 2>/dev/null
lsof -ti:5175 | xargs kill -9 2>/dev/null

# Kill PIDs if saved
if [ -f logs/backend.pid ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    kill -9 $BACKEND_PID 2>/dev/null
    rm logs/backend.pid
fi

if [ -f logs/frontend.pid ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    kill -9 $FRONTEND_PID 2>/dev/null
    rm logs/frontend.pid
fi

sleep 1

echo -e "${GREEN}✅ All services stopped${NC}"
