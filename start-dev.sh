#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting 6Soft HRM Development Environment${NC}"
echo ""

# Kill processes on ports 4000 and 5173-5175
echo -e "${BLUE}🔪 Killing existing processes on ports 4000, 5173-5175...${NC}"
lsof -ti:4000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
lsof -ti:5174 | xargs kill -9 2>/dev/null
lsof -ti:5175 | xargs kill -9 2>/dev/null
sleep 1

# Start backend
echo -e "${GREEN}✅ Starting backend on port 4000...${NC}"
cd backend
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
echo -e "${BLUE}⏳ Waiting for backend to start...${NC}"
sleep 3

# Check if backend is running
if curl -s http://localhost:4000/api/health > /dev/null; then
    echo -e "${GREEN}✅ Backend is running on http://localhost:4000${NC}"
else
    echo -e "${RED}❌ Backend failed to start. Check logs/backend.log${NC}"
    exit 1
fi

# Start frontend
echo -e "${GREEN}✅ Starting frontend...${NC}"
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo ""
echo -e "${GREEN}🎉 Development environment started!${NC}"
echo -e "${BLUE}📊 Backend:  http://localhost:4000${NC}"
echo -e "${BLUE}🌐 Frontend: http://localhost:5173 (or next available port)${NC}"
echo ""
echo -e "${BLUE}📝 Logs:${NC}"
echo -e "   Backend:  tail -f logs/backend.log"
echo -e "   Frontend: tail -f logs/frontend.log"
echo ""
echo -e "${RED}To stop all services, run: ./stop-dev.sh${NC}"
echo ""

# Save PIDs to file for cleanup
mkdir -p logs
echo $BACKEND_PID > logs/backend.pid
echo $FRONTEND_PID > logs/frontend.pid
