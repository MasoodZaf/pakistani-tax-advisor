#!/usr/bin/env python3
"""
Development server runner for Pakistani Tax Advisor API
"""

import uvicorn
import os

if __name__ == "__main__":
    print("🚀 Starting Pakistani Tax Advisor API Development Server...")
    print("🇵🇰 Tax Year: 2024-25")
    print("📊 API Documentation: http://localhost:8000/docs")
    print("🔗 Health Check: http://localhost:8000/health")
    print("=" * 50)
    
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info",
        access_log=True,
        reload_dirs=["backend"]
    ) 