#!/bin/bash

# Quick Deployment Script for Render + Hostinger
# This script helps verify everything is ready for deployment

set -e

echo "🚀 6Soft HRM - Production Deployment Preparation"
echo "================================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

# Check for uncommitted changes
echo "📋 Checking git status..."
if [[ -n $(git status -s) ]]; then
    echo "⚠️  Warning: You have uncommitted changes"
    git status -s
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Show current commit
echo ""
echo "📦 Current commit:"
git log -1 --oneline
echo ""

# Check database migrations
echo "🗄️  Checking database migrations..."
cd backend
if [ ! -d "prisma/migrations" ]; then
    echo "❌ No migrations found!"
    exit 1
fi

MIGRATION_COUNT=$(ls -1 prisma/migrations | grep -v migration_lock.toml | wc -l | tr -d ' ')
echo "✅ Found $MIGRATION_COUNT migrations"
ls -1 prisma/migrations | grep -v migration_lock.toml | tail -3
echo ""

# Check for seed data
echo "🌱 Checking seed data..."
if [ -f "seed-sample-data.sql" ]; then
    echo "✅ Sample seed data available: seed-sample-data.sql"
    EMPLOYEE_COUNT=$(grep -c "INSERT INTO.*Employee" seed-sample-data.sql || echo "0")
    echo "   Contains: ~$EMPLOYEE_COUNT employees"
else
    echo "⚠️  No seed data file found"
fi
echo ""

# Check backend dependencies
echo "📦 Checking backend setup..."
if [ ! -d "node_modules" ]; then
    echo "⚠️  Backend dependencies not installed"
    read -p "Install now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm install
    fi
else
    echo "✅ Backend dependencies installed"
fi

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found (OK for Render - will use env vars)"
else
    echo "✅ .env file exists (for local dev)"
fi
echo ""

# Check frontend
echo "🎨 Checking frontend setup..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    echo "⚠️  Frontend dependencies not installed"
    read -p "Install now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm install
    fi
else
    echo "✅ Frontend dependencies installed"
fi
cd ..

echo ""
echo "================================================"
echo "✅ Pre-deployment checks complete!"
echo ""
echo "📝 Next Steps for Render Deployment:"
echo ""
echo "1. Push to GitHub:"
echo "   git push origin change_to_mysql"
echo ""
echo "2. Render will auto-deploy if connected to GitHub"
echo ""
echo "3. After first deploy, run in Render shell:"
echo "   npx prisma migrate deploy"
echo "   node tools/link-users-to-employees.js"
echo ""
echo "4. Optional: Seed sample data in Render shell:"
echo "   mysql -h <host> -u <user> -p <db> < seed-sample-data.sql"
echo ""
echo "5. Update frontend with Render API URL:"
echo "   VITE_API_URL=https://your-app.onrender.com/api"
echo ""
echo "📚 See DEPLOYMENT_STEPS.md for detailed instructions"
echo "🎨 See RENDER_DEPLOYMENT.md for Render + Hostinger guide"
echo ""
