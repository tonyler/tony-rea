#!/bin/bash

set -e

echo "🚀 Installing Tony & Rea..."
echo ""

# Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18 or higher is required"
    echo "   Current version: $(node --version)"
    exit 1
fi
echo "✅ Node.js $(node --version) detected"
echo ""

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
echo "✅ Backend dependencies installed"
echo ""

# Build backend
echo "🔨 Building backend..."
npm run build
echo "✅ Backend built"
echo ""

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install
echo "✅ Frontend dependencies installed"
echo ""

# Build frontend
echo "🔨 Building frontend..."
npm run build
echo "✅ Frontend built"
echo ""

# Create data directory
echo "📁 Creating data directory..."
cd ..
mkdir -p data/projects logs
echo "✅ Data directory created"
echo ""

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
    echo "⚠️  Please edit .env and add your OpenAI API key!"
    echo ""
fi

echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your OPENAI_API_KEY"
echo "2. Run ./scripts/start.sh to start the server"
echo ""
