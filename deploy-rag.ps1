# TurboDocAI RAG Pipeline Deployment Script
Write-Host "🚀 Setting up TurboDocAI RAG Pipeline..." -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "firebase.json")) {
    Write-Host "❌ Error: Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

# Install functions dependencies
Write-Host "📦 Installing Cloud Functions dependencies..." -ForegroundColor Yellow
Set-Location functions
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Check for required environment variables
Write-Host "🔍 Checking environment variables..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "❌ Error: .env file not found in functions directory" -ForegroundColor Red
    Write-Host "Please create functions/.env with the required API keys" -ForegroundColor Yellow
    exit 1
}

# Build functions
Write-Host "🔨 Building Cloud Functions..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: Failed to build functions" -ForegroundColor Red
    exit 1
}

# Go back to root
Set-Location ..

# Check if Firebase CLI is installed
Write-Host "🔍 Checking Firebase CLI..." -ForegroundColor Yellow
try {
    firebase --version | Out-Null
} catch {
    Write-Host "❌ Error: Firebase CLI not found" -ForegroundColor Red
    Write-Host "Please install it with: npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Check if logged in to Firebase
Write-Host "🔐 Checking Firebase authentication..." -ForegroundColor Yellow
firebase projects:list 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: Not logged in to Firebase" -ForegroundColor Red
    Write-Host "Please run: firebase login" -ForegroundColor Yellow
    exit 1
}

# Deploy functions
Write-Host "🚀 Deploying Cloud Functions..." -ForegroundColor Yellow
firebase deploy --only functions

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Cloud Functions deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Error: Failed to deploy functions" -ForegroundColor Red
    exit 1
}

# Deploy Firestore rules and indexes
Write-Host "📋 Deploying Firestore rules and indexes..." -ForegroundColor Yellow
firebase deploy --only firestore

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Firestore rules and indexes deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Error: Failed to deploy Firestore configuration" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 RAG Pipeline Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Ensure OPENAI_API_KEY is set in your Functions environment" -ForegroundColor White
Write-Host "2. Optionally set OPENAI_VECTOR_STORE_ID if using a pre-created store; otherwise the app manages uploads per document" -ForegroundColor White
Write-Host "3. Test by uploading a PDF document" -ForegroundColor White
Write-Host ""
Write-Host "📚 For detailed documentation, see RAG_IMPLEMENTATION.md" -ForegroundColor Cyan
