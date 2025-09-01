#!/bin/bash

echo "🚀 Setting up TurboDocAI RAG Pipeline..."

# Check if we're in the right directory
if [ ! -f "firebase.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Install functions dependencies
echo "📦 Installing Cloud Functions dependencies..."
cd functions
npm install

# Check for required environment variables
echo "🔍 Checking environment variables..."
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found in functions directory"
    echo "Please create functions/.env with the required API keys"
    exit 1
fi

# Build functions
echo "🔨 Building Cloud Functions..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to build functions"
    exit 1
fi

# Go back to root
cd ..

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Error: Firebase CLI not found"
    echo "Please install it with: npm install -g firebase-tools"
    exit 1
fi

# Check if logged in to Firebase
echo "🔐 Checking Firebase authentication..."
firebase projects:list > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Error: Not logged in to Firebase"
    echo "Please run: firebase login"
    exit 1
fi

# Deploy functions
echo "🚀 Deploying Cloud Functions..."
firebase deploy --only functions

if [ $? -eq 0 ]; then
    echo "✅ Cloud Functions deployed successfully!"
else
    echo "❌ Error: Failed to deploy functions"
    exit 1
fi

# Deploy Firestore rules and indexes
echo "📋 Deploying Firestore rules and indexes..."
firebase deploy --only firestore

if [ $? -eq 0 ]; then
    echo "✅ Firestore rules and indexes deployed successfully!"
else
    echo "❌ Error: Failed to deploy Firestore configuration"
    exit 1
fi

echo ""
echo "🎉 RAG Pipeline Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Create a Pinecone index named 'tnotesai' with 1536 dimensions"
echo "2. Set up your Pinecone API key in the Firebase console"
echo "3. Test by uploading a PDF document"
echo ""
echo "📚 For detailed documentation, see RAG_IMPLEMENTATION.md"
