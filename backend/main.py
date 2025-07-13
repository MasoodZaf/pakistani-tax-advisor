"""
Pakistani Tax Advisor - FastAPI Backend
Main application entry point for the Pakistani tax calculation API
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
import uvicorn
import os
from contextlib import asynccontextmanager

from backend.app.api.tax_routes import router as tax_router

# Application metadata
APP_TITLE = "Pakistani Tax Advisor API"
APP_DESCRIPTION = """
🇵🇰 **Pakistani Tax Advisor API**

A comprehensive REST API for calculating Pakistani income tax based on the latest 2024-25 tax slabs 
as per the Federal Budget 2024-25.

## Features

* **Progressive Tax Calculation**: Accurate tax calculation using official Pakistani tax slabs
* **Multiple Taxpayer Types**: Support for salaried and non-salaried individuals
* **Filer Status**: Different calculations for tax filers vs non-filers  
* **Additional Taxes**: Automatic calculation of additional tax for high earners (>10M)
* **Super Tax**: Super tax calculation for very high earners (>150M)
* **Detailed Breakdown**: Slab-wise tax breakdown with effective and marginal rates
* **Real-time Calculation**: Fast and accurate tax calculations

## Tax Year 2024-25

All calculations are based on the official tax slabs announced in the Federal Budget 2024-25:

### Salaried Individuals
- 0% up to Rs. 600,000
- 5% for Rs. 600,001 - Rs. 1,200,000
- 15% for Rs. 1,200,001 - Rs. 2,200,000
- 25% for Rs. 2,200,001 - Rs. 3,200,000
- 30% for Rs. 3,200,001 - Rs. 4,100,000
- 35% above Rs. 4,100,000

### Non-Salaried Individuals & AOP
- 0% up to Rs. 600,000
- 15% for Rs. 600,001 - Rs. 1,200,000
- 20% for Rs. 1,200,001 - Rs. 1,600,000
- 30% for Rs. 1,600,001 - Rs. 3,200,000
- 40% for Rs. 3,200,001 - Rs. 5,600,000
- 45% above Rs. 5,600,000

## Usage

Use the interactive API documentation below to test the endpoints or integrate with your application.
"""

APP_VERSION = "1.0.0"

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    print("🚀 Starting Pakistani Tax Advisor API...")
    print("📊 Tax slabs loaded for 2024-25")
    print("🇵🇰 Ready to calculate Pakistani taxes!")
    yield
    # Shutdown
    print("👋 Pakistani Tax Advisor API shutting down...")

# Create FastAPI application
app = FastAPI(
    title=APP_TITLE,
    description=APP_DESCRIPTION,
    version=APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    contact={
        "name": "Pakistani Tax Advisor",
        "url": "https://github.com/MasoodZaf/pakistani-tax-advisor",
    },
    license_info={
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT",
    },
    tags_metadata=[
        {
            "name": "Tax Calculator",
            "description": "Pakistani income tax calculation endpoints for 2024-25",
        },
        {
            "name": "Health",
            "description": "Application health and status endpoints",
        },
    ]
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React development server
        "http://localhost:3001",  # Alternative React port
        "http://127.0.0.1:3000",
        "https://pakistani-tax-advisor.vercel.app",  # Production frontend
        "https://pakistani-tax-advisor.netlify.app",  # Alternative production
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include routers
app.include_router(tax_router)

# Custom exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom HTTP exception handler"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "path": str(request.url.path)
        }
    )

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Handle ValueError exceptions"""
    return JSONResponse(
        status_code=400,
        content={
            "error": f"Invalid input: {str(exc)}",
            "status_code": 400,
            "path": str(request.url.path)
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions"""
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc),
            "status_code": 500,
            "path": str(request.url.path)
        }
    )

# Health check endpoints
@app.get("/", tags=["Health"])
async def root():
    """Root endpoint with API information"""
    return {
        "message": "🇵🇰 Pakistani Tax Advisor API",
        "version": APP_VERSION,
        "tax_year": "2024-25",
        "status": "healthy",
        "docs": "/docs",
        "github": "https://github.com/MasoodZaf/pakistani-tax-advisor"
    }

@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": "2024-01-01T00:00:00Z",  # This would be current timestamp in real app
        "version": APP_VERSION,
        "tax_year": "2024-25"
    }

# Custom OpenAPI schema
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title=APP_TITLE,
        version=APP_VERSION,
        description=APP_DESCRIPTION,
        routes=app.routes,
    )
    
    # Add custom metadata
    openapi_schema["info"]["x-logo"] = {
        "url": "https://flagcdn.com/w320/pk.png",
        "altText": "Pakistan Flag"
    }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

# Development server
if __name__ == "__main__":
    # This runs when you execute: python backend/main.py
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True,  # Enable auto-reload for development
        log_level="info"
    ) 