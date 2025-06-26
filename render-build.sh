#!/usr/bin/env bash
# Render build script

echo "🚀 Starting Render build process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p data
mkdir -p logs

# Set up environment
echo "⚙️ Setting up environment..."
export NODE_ENV=production

# Run any additional setup if needed
echo "🔧 Running setup tasks..."

# Download initial data if GitHub token is available
if [ ! -z "$GITHUB_TOKEN" ]; then
    echo "📊 Attempting to download initial data..."
    node scripts/download-initial-data.js || echo "⚠️ Initial data download failed, will try at runtime"
fi

echo "✅ Build completed successfully!"