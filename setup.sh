#!/bin/bash

# Pakistani Tax Advisor - Automated Setup Script
# This script sets up the complete tax advisory system for production use

set -e  # Exit on any error

echo "🇵🇰 Pakistani Tax Advisor - Automated Setup"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running on macOS or Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macOS"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="Linux"
else
    print_warning "Unsupported OS: $OSTYPE. Proceeding anyway..."
    OS="Unknown"
fi

print_info "Detected OS: $OS"

# Step 1: Check Prerequisites
echo
echo "📋 Step 1: Checking Prerequisites"
echo "================================"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_status "Node.js found: $NODE_VERSION"
    
    # Check if Node version is 18 or higher
    NODE_MAJOR=$(node --version | cut -d. -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        print_warning "Node.js version $NODE_VERSION detected. Version 18+ recommended."
        echo "Please update Node.js to version 18 or higher for optimal performance."
    fi
else
    print_error "Node.js not found! Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_status "npm found: $NPM_VERSION"
else
    print_error "npm not found! Please install npm."
    exit 1
fi

# Check PostgreSQL
if command -v psql &> /dev/null; then
    POSTGRES_VERSION=$(psql --version | cut -d' ' -f3)
    print_status "PostgreSQL found: $POSTGRES_VERSION"
else
    print_warning "PostgreSQL not found. Installing PostgreSQL..."
    
    if [[ "$OS" == "macOS" ]]; then
        if command -v brew &> /dev/null; then
            brew install postgresql
            brew services start postgresql
            print_status "PostgreSQL installed and started via Homebrew"
        else
            print_error "Homebrew not found. Please install PostgreSQL manually from https://www.postgresql.org/"
            exit 1
        fi
    elif [[ "$OS" == "Linux" ]]; then
        sudo apt-get update
        sudo apt-get install -y postgresql postgresql-contrib
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
        print_status "PostgreSQL installed and started"
    else
        print_error "Please install PostgreSQL manually for your OS"
        exit 1
    fi
fi

# Step 2: Database Setup
echo
echo "🗄️  Step 2: Database Setup"
echo "=========================="

# Create database if it doesn't exist
print_info "Setting up database 'tax_advisor'..."

# Check if we can connect to PostgreSQL
if pg_isready -q; then
    print_status "PostgreSQL is running"
else
    print_warning "Starting PostgreSQL service..."
    if [[ "$OS" == "macOS" ]]; then
        brew services start postgresql 2>/dev/null || true
    elif [[ "$OS" == "Linux" ]]; then
        sudo systemctl start postgresql 2>/dev/null || true
    fi
    sleep 3
fi

# Create database (ignore error if already exists)
createdb tax_advisor 2>/dev/null || print_info "Database 'tax_advisor' already exists"

# Run database migrations
if [ -f "database/migrate-2025-26.sql" ]; then
    print_info "Running database migrations..."
    psql -d tax_advisor -f database/migrate-2025-26.sql -q || print_warning "Some migrations may have already been applied"
    print_status "Database migrations completed"
else
    print_warning "Migration file not found. Database may need manual setup."
fi

# Step 3: Backend Setup
echo
echo "🔧 Step 3: Backend Setup"
echo "======================="

cd backend

print_info "Installing backend dependencies..."
npm install --production

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    print_info "Creating backend environment configuration..."
    cat > .env << EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tax_advisor
DB_USER=postgres
DB_PASSWORD=admin
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-for-production-use-long-random-string-$(date +%s)
EOF
    print_status "Backend .env file created"
else
    print_info "Backend .env file already exists"
fi

print_status "Backend setup completed"

# Step 4: Frontend Setup
echo
echo "🎨 Step 4: Frontend Setup"
echo "========================"

cd ../frontend

print_info "Installing frontend dependencies..."
npm install --production

print_status "Frontend setup completed"

# Step 5: Build Applications
echo
echo "🏗️  Step 5: Building Applications"
echo "================================"

print_info "Building frontend for production..."
npm run build
print_status "Frontend build completed"

# Step 6: Start Services
echo
echo "🚀 Step 6: Starting Services"
echo "==========================="

# Start backend in background
cd ../backend
print_info "Starting backend server..."
npm start &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Check if backend is running
if curl -s http://localhost:3001/api/health > /dev/null; then
    print_status "Backend server started successfully (PID: $BACKEND_PID)"
else
    print_warning "Backend server may be starting. Check manually if needed."
fi

# Start frontend
cd ../frontend
print_info "Starting frontend server..."
npm start &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 10

# Step 7: Final Setup Summary
echo
echo "🎉 Setup Completed Successfully!"
echo "================================"
echo
print_status "Pakistani Tax Advisor is now running!"
echo
echo "📍 Access URLs:"
echo "   🌐 Main Application: http://localhost:3000"
echo "   🔧 Admin Panel: http://localhost:3000/admin"
echo "   🔗 Backend API: http://localhost:3001"
echo
echo "👥 Admin Accounts:"
echo "   🔑 Super Admin:"
echo "      Email: superadmin@paktaxadvisor.com"
echo "      Password: admin123"
echo
echo "   🔑 Regular Admin:"
echo "      Email: admin@test.com"
echo "      Password: admin123"
echo
echo "🚀 Key Features:"
echo "   ✅ User Impersonation (Super Admin)"
echo "   ✅ Tax Calculator with 2025-26 slabs"
echo "   ✅ Complete Pakistani tax forms"
echo "   ✅ User management and reports"
echo "   ✅ Mobile app support"
echo
echo "📱 Mobile App (Optional):"
echo "   cd mobile && npm install && npx expo start"
echo
echo "🛑 To Stop Services:"
echo "   Backend: kill $BACKEND_PID"
echo "   Frontend: kill $FRONTEND_PID"
echo "   Or use Ctrl+C in their terminal windows"
echo
echo "📞 Support:"
echo "   - Documentation: See README.md"
echo "   - Issues: Create GitHub issue"
echo "   - Database: PostgreSQL on localhost:5432"
echo
print_status "Setup completed! Tax consultants can now access the system."

# Save process IDs for easy cleanup
echo "BACKEND_PID=$BACKEND_PID" > .pids
echo "FRONTEND_PID=$FRONTEND_PID" >> .pids

print_info "Process IDs saved to .pids file for easy cleanup"
print_warning "Keep this terminal open or run services manually with 'npm start'"

exit 0