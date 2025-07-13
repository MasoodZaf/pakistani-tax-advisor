# backend/app/main.py
"""
Pakistani Tax Advisor - FastAPI Backend Application
Modern API for Pakistani tax calculations with user management
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Dict, List, Optional
from jose import jwt
import hashlib
import json
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import copy

# =============================================================================
# CONFIGURATION
# =============================================================================

SECRET_KEY = "pakistani-tax-advisor-super-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# =============================================================================
# FASTAPI APP SETUP
# =============================================================================

app = FastAPI(
    title="Pakistani Tax Advisor API", 
    version="1.0.0",
    description="""
    🇵🇰 **Pakistani Tax Advisor API**
    
    Modern API for Pakistani tax calculations with user management.
    
    ## Features
    - 🧮 Pakistani tax slabs 2024-25
    - 🔐 JWT authentication
    - 👨‍💼 Admin panel
    - 📊 Real-time calculations
    - 📱 Mobile-friendly
    
    ## Demo Accounts
    - **Admin**: admin@tax.pk / admin123
    - **User**: user@demo.pk / user123
    """,
    contact={
        "name": "Pakistani Tax Advisor Team",
        "email": "support@taxadvisor.pk",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
)

security = HTTPBearer()

# CORS middleware for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative React dev
        "http://localhost:80",    # Production frontend
        "https://yourdomain.com", # Production domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# DATA MODELS
# =============================================================================

@dataclass
class TaxData:
    """Tax data structure for comprehensive tax calculations"""
    income: Dict[str, float]
    adjustments: Dict[str, float]
    deductions: Dict[str, float]
    wealth: Dict[str, float]

@dataclass
class User:
    """User data structure with tax information"""
    id: int
    email: str
    name: str
    password: str
    role: str
    data: TaxData
    created_at: str = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()

# =============================================================================
# PYDANTIC MODELS FOR API VALIDATION
# =============================================================================

class UserCreate(BaseModel):
    """User registration model"""
    email: EmailStr
    name: str
    password: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "name": "John Doe",
                "password": "secure123"
            }
        }

class UserLogin(BaseModel):
    """User login model"""
    email: EmailStr
    password: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@demo.pk",
                "password": "user123"
            }
        }

class TaxDataUpdate(BaseModel):
    """Tax data update model"""
    section: str
    field: str
    value: float
    
    class Config:
        json_schema_extra = {
            "example": {
                "section": "income",
                "field": "salary",
                "value": 5000000
            }
        }

class TaxDataResponse(BaseModel):
    """Tax data response model"""
    income: Dict[str, float]
    adjustments: Dict[str, float]
    deductions: Dict[str, float]
    wealth: Dict[str, float]

class TaxSummaryResponse(BaseModel):
    """Tax summary response model"""
    total_income: float
    taxable_income: float
    normal_tax: float
    tax_credits: float
    final_tax: float
    tax_paid: float
    balance: float
    net_worth: float
    effective_rate: float

class Token(BaseModel):
    """Authentication token response"""
    access_token: str
    token_type: str
    user: Dict

# =============================================================================
# PAKISTANI TAX ENGINE
# =============================================================================

class PakistaniTaxEngine:
    """
    Pakistani Tax Calculation Engine
    Implements FBR tax slabs for 2024-25 fiscal year
    """
    
    # Pakistani Income Tax Slabs 2024-25
    TAX_SLABS = [
        (0, 600000, 0.0),           # No tax up to PKR 600,000
        (600001, 1200000, 0.05),    # 5% on next PKR 600,000
        (1200001, 2200000, 0.15),   # 15% on next PKR 1,000,000
        (2200001, 3200000, 0.25),   # 25% on next PKR 1,000,000
        (3200001, 4100000, 0.30),   # 30% on next PKR 900,000
        (4100001, float('inf'), 0.35) # 35% on remaining amount
    ]
    
    @classmethod
    def calculate_tax(cls, income: float) -> float:
        """
        Calculate progressive income tax based on Pakistani tax slabs
        
        Args:
            income (float): Annual taxable income in PKR
            
        Returns:
            float: Calculated tax amount in PKR
        """
        if income <= 0:
            return 0
            
        tax = 0
        prev = 0
        
        for min_val, max_val, rate in cls.TAX_SLABS:
            if income > min_val:
                upper = min(income, max_val)
                taxable_in_slab = upper - prev
                tax += taxable_in_slab * rate
                prev = max_val
            else:
                break
        
        return round(tax, 2)
    
    @classmethod
    def calculate_tax_summary(cls, data: TaxData) -> Dict[str, float]:
        """
        Calculate comprehensive tax summary with all deductions and credits
        
        Args:
            data (TaxData): User's complete tax data
            
        Returns:
            Dict[str, float]: Complete tax calculation summary
        """
        # Total income calculation
        income_fields = ["salary", "bonus", "car", "other"]
        total_income = sum(data.income.get(field, 0) for field in income_fields)
        
        # Taxable income after zakat deduction (as per Islamic principles)
        zakat = data.deductions.get("zakat", 0)
        taxable_income = max(0, total_income - zakat)
        
        # Tax calculations using Pakistani slabs
        normal_tax = cls.calculate_tax(taxable_income)
        
        # Tax credits (charity + pension contributions)
        charity = data.deductions.get("charity", 0)
        pension = data.deductions.get("pension", 0)
        tax_credits = charity + pension
        
        # Final tax liability after credits
        final_tax = max(0, normal_tax - tax_credits)
        
        # Tax already paid/deducted by employer
        tax_paid = data.income.get("taxDeducted", 0)
        
        # Balance calculation (positive = refund, negative = additional due)
        balance = tax_paid - final_tax
        
        # Wealth calculation
        wealth_fields = ["property", "investment", "vehicle", "cash"]
        total_wealth = sum(data.wealth.get(field, 0) for field in wealth_fields)
        loans = data.wealth.get("loans", 0)
        net_worth = total_wealth - loans
        
        # Effective tax rate
        effective_rate = (final_tax / taxable_income * 100) if taxable_income > 0 else 0
        
        return {
            "total_income": round(total_income, 2),
            "taxable_income": round(taxable_income, 2),
            "normal_tax": round(normal_tax, 2),
            "tax_credits": round(tax_credits, 2),
            "final_tax": round(final_tax, 2),
            "tax_paid": round(tax_paid, 2),
            "balance": round(balance, 2),
            "net_worth": round(net_worth, 2),
            "effective_rate": round(effective_rate, 2)
        }

# =============================================================================
# IN-MEMORY STORAGE (REPLACE WITH DATABASE IN PRODUCTION)
# =============================================================================

users_db: List[User] = []

# Tax data sections configuration
sections = {
    "income": ["salary", "bonus", "car", "other", "taxDeducted"],
    "adjustments": ["debt", "electricity", "phone", "vehicle"],
    "deductions": ["zakat", "charity", "pension"],
    "wealth": ["property", "investment", "vehicle", "cash", "loans"]
}

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def hash_password(password: str) -> str:
    """Hash password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def create_access_token(data: dict) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Get current authenticated user from JWT token"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )
        
        user = next((u for u in users_db if u.email == email), None)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        return user
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )

# =============================================================================
# DEMO DATA INITIALIZATION
# =============================================================================

def init_demo_data():
    """Initialize application with demo users for testing"""
    # Admin user with comprehensive tax data
    admin_data = TaxData(
        income={
            "salary": 7200000,      # PKR 7.2M annual salary
            "bonus": 1500000,       # PKR 1.5M bonus
            "car": 50000,           # PKR 50K car benefit
            "other": 0,             # No other income
            "taxDeducted": 2200000  # PKR 2.2M tax deducted
        },
        adjustments={
            "debt": 0,
            "electricity": 0,
            "phone": 0,
            "vehicle": 0
        },
        deductions={
            "zakat": 10000,         # PKR 10K zakat
            "charity": 50000,       # PKR 50K charity (tax credit)
            "pension": 500000       # PKR 500K pension (tax credit)
        },
        wealth={
            "property": 5000000,    # PKR 5M property
            "investment": 2500000,  # PKR 2.5M investments
            "vehicle": 2500000,     # PKR 2.5M vehicle
            "cash": 240000,         # PKR 240K cash
            "loans": 300000         # PKR 300K loans
        }
    )
    
    # Regular user with moderate tax data
    user_data = TaxData(
        income={
            "salary": 5000000,      # PKR 5M annual salary
            "bonus": 500000,        # PKR 500K bonus
            "car": 30000,           # PKR 30K car benefit
            "other": 0,             # No other income
            "taxDeducted": 1200000  # PKR 1.2M tax deducted
        },
        adjustments={
            "debt": 0,
            "electricity": 0,
            "phone": 0,
            "vehicle": 0
        },
        deductions={
            "zakat": 5000,          # PKR 5K zakat
            "charity": 25000,       # PKR 25K charity
            "pension": 250000       # PKR 250K pension
        },
        wealth={
            "property": 2200000,    # PKR 2.2M property
            "investment": 1200000,  # PKR 1.2M investments
            "vehicle": 1400000,     # PKR 1.4M vehicle
            "cash": 150000,         # PKR 150K cash
            "loans": 100000         # PKR 100K loans
        }
    )
    
    # Create demo users
    demo_users = [
        User(1, "admin@tax.pk", "Tax Admin", hash_password("admin123"), "admin", admin_data),
        User(2, "user@demo.pk", "Demo User", hash_password("user123"), "user", user_data)
    ]
    
    users_db.extend(demo_users)

# =============================================================================
# API ROUTES
# =============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    init_demo_data()
    print("🚀 Pakistani Tax Advisor API started successfully!")
    print("📋 Demo accounts available:")
    print("   👨‍💼 Admin: admin@tax.pk / admin123")
    print("   👤 User: user@demo.pk / user123")

@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint with API information
    """
    return {
        "message": "🇵🇰 Pakistani Tax Advisor API is running!",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "status": "healthy",
        "demo_accounts": [
            {"email": "admin@tax.pk", "password": "admin123", "role": "admin"},
            {"email": "user@demo.pk", "password": "user123", "role": "user"}
        ],
        "features": [
            "Pakistani tax slabs 2024-25",
            "JWT authentication",
            "Real-time calculations", 
            "Admin dashboard",
            "Mobile responsive"
        ]
    }

# =============================================================================
# AUTHENTICATION ROUTES
# =============================================================================

@app.post("/api/auth/register", response_model=Token, tags=["Authentication"])
async def register(user_data: UserCreate):
    """
    Register a new user
    
    - **email**: Valid email address
    - **name**: Full name of the user
    - **password**: Password (minimum 6 characters)
    """
    # Check if email already exists
    if any(u.email == user_data.email for u in users_db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Validate password length
    if len(user_data.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters"
        )
    
    # Determine user role (admin for specific email)
    role = "admin" if user_data.email == "admin@tax.pk" else "user"
    
    # Create default tax data structure
    default_data = TaxData(
        income={"salary": 0, "bonus": 0, "car": 0, "other": 0, "taxDeducted": 0},
        adjustments={"debt": 0, "electricity": 0, "phone": 0, "vehicle": 0},
        deductions={"zakat": 0, "charity": 0, "pension": 0},
        wealth={"property": 0, "investment": 0, "vehicle": 0, "cash": 0, "loans": 0}
    )
    
    # Create new user
    new_user = User(
        id=len(users_db) + 1,
        email=user_data.email,
        name=user_data.name,
        password=hash_password(user_data.password),
        role=role,
        data=default_data
    )
    
    users_db.append(new_user)
    
    # Create access token
    access_token = create_access_token(data={"sub": new_user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id, 
            "email": new_user.email, 
            "name": new_user.name, 
            "role": new_user.role
        }
    }

@app.post("/api/auth/login", response_model=Token, tags=["Authentication"])
async def login(user_credentials: UserLogin):
    """
    Login user
    
    - **email**: Registered email address
    - **password**: User password
    
    **Demo accounts:**
    - admin@tax.pk / admin123 (Admin access)
    - user@demo.pk / user123 (Regular user)
    """
    user = next((u for u in users_db 
                if u.email == user_credentials.email 
                and u.password == hash_password(user_credentials.password)), None)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    access_token = create_access_token(data={"sub": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id, 
            "email": user.email, 
            "name": user.name, 
            "role": user.role
        }
    }

# =============================================================================
# TAX DATA ROUTES
# =============================================================================

@app.get("/api/tax/data", response_model=TaxDataResponse, tags=["Tax Data"])
async def get_tax_data(current_user: User = Depends(get_current_user)):
    """
    Get user's complete tax data
    
    Returns all tax information including:
    - Income details (salary, bonus, benefits)
    - Adjustments and deductions
    - Wealth and assets information
    """
    return TaxDataResponse(
        income=current_user.data.income,
        adjustments=current_user.data.adjustments,
        deductions=current_user.data.deductions,
        wealth=current_user.data.wealth
    )

@app.put("/api/tax/data", tags=["Tax Data"])
async def update_tax_data(update: TaxDataUpdate, current_user: User = Depends(get_current_user)):
    """
    Update specific tax data field
    
    - **section**: Tax section (income, adjustments, deductions, wealth)
    - **field**: Specific field within the section
    - **value**: New value for the field (in PKR)
    """
    if update.section not in sections or update.field not in sections[update.section]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid section '{update.section}' or field '{update.field}'"
        )
    
    # Validate value is non-negative
    if update.value < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tax values must be non-negative"
        )
    
    # Update the field
    section_data = getattr(current_user.data, update.section)
    section_data[update.field] = update.value
    
    return {
        "message": "Tax data updated successfully",
        "section": update.section,
        "field": update.field,
        "value": update.value
    }

@app.get("/api/tax/summary", response_model=TaxSummaryResponse, tags=["Tax Calculations"])
async def get_tax_summary(current_user: User = Depends(get_current_user)):
    """
    Get comprehensive tax calculation summary
    
    Calculates:
    - Total and taxable income
    - Tax liability using Pakistani tax slabs
    - Tax credits and deductions
    - Final tax amount and balance
    - Net worth calculation
    - Effective tax rate
    """
    summary = PakistaniTaxEngine.calculate_tax_summary(current_user.data)
    return TaxSummaryResponse(**summary)

@app.get("/api/tax/slabs", tags=["Tax Information"])
async def get_tax_slabs():
    """
    Get Pakistani income tax slabs for 2024-25
    
    Returns the current tax brackets and rates
    """
    slabs = []
    for i, (min_val, max_val, rate) in enumerate(PakistaniTaxEngine.TAX_SLABS):
        slab = {
            "slab": i + 1,
            "min_amount": min_val,
            "max_amount": max_val if max_val != float('inf') else None,
            "rate": rate,
            "rate_percentage": f"{rate * 100:.1f}%"
        }
        
        if max_val == float('inf'):
            slab["description"] = f"Above PKR {min_val:,} - {slab['rate_percentage']}"
        elif min_val == 0:
            slab["description"] = f"Up to PKR {max_val:,} - {slab['rate_percentage']}"
        else:
            slab["description"] = f"PKR {min_val:,} to PKR {max_val:,} - {slab['rate_percentage']}"
            
        slabs.append(slab)
    
    return {
        "tax_year": "2024-25",
        "currency": "PKR",
        "slabs": slabs,
        "note": "These are the official Pakistani income tax slabs for fiscal year 2024-25"
    }

# =============================================================================
# ADMIN ROUTES
# =============================================================================

@app.get("/api/admin/users", tags=["Admin"])
async def get_all_users(current_user: User = Depends(get_current_user)):
    """
    Get all users with their tax summaries (Admin only)
    
    Requires admin role to access user management features
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    users_with_summaries = []
    for user in users_db:
        tax_summary = PakistaniTaxEngine.calculate_tax_summary(user.data)
        users_with_summaries.append({
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "created_at": user.created_at,
            "tax_summary": tax_summary
        })
    
    return users_with_summaries

@app.delete("/api/admin/users/{user_id}", tags=["Admin"])
async def delete_user(user_id: int, current_user: User = Depends(get_current_user)):
    """
    Delete a user (Admin only)
    
    - **user_id**: ID of the user to delete
    
    Note: Cannot delete admin users
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    user_to_delete = next((u for u in users_db if u.id == user_id), None)
    if not user_to_delete:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user_to_delete.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete admin user"
        )
    
    users_db.remove(user_to_delete)
    return {"message": f"User {user_to_delete.name} deleted successfully"}

@app.get("/api/admin/stats", tags=["Admin"])
async def get_admin_stats(current_user: User = Depends(get_current_user)):
    """
    Get system statistics (Admin only)
    
    Returns comprehensive system analytics and metrics
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    total_users = len(users_db)
    admin_users = len([u for u in users_db if u.role == "admin"])
    regular_users = total_users - admin_users
    
    # Calculate total tax liability across all users
    total_tax = sum(PakistaniTaxEngine.calculate_tax_summary(u.data)["final_tax"] for u in users_db)
    
    # Calculate average income
    total_income = sum(PakistaniTaxEngine.calculate_tax_summary(u.data)["total_income"] for u in users_db)
    avg_income = total_income / total_users if total_users > 0 else 0
    
    return {
        "total_users": total_users,
        "admin_users": admin_users,
        "regular_users": regular_users,
        "total_tax_liability": round(total_tax, 2),
        "average_income": round(avg_income, 2),
        "system_health": "healthy",
        "api_version": "1.0.0"
    }

# =============================================================================
# HEALTH CHECK ROUTES
# =============================================================================

@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint for monitoring
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "service": "pakistani-tax-advisor-api",
        "users_count": len(users_db),
        "uptime": "running"
    }

@app.get("/api/ping", tags=["Health"])
async def ping():
    """
    Simple ping endpoint
    """
    return {"message": "pong", "timestamp": datetime.now().isoformat()}

# =============================================================================
# ERROR HANDLERS
# =============================================================================

@app.exception_handler(404)
async def not_found_handler(request, exc):
    return {"error": "Endpoint not found", "message": "The requested endpoint does not exist"}

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    return {"error": "Internal server error", "message": "Something went wrong on our end"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)