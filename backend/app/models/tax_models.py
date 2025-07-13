from pydantic import BaseModel, Field, validator
from typing import List, Optional
from enum import Enum

class TaxpayerType(str, Enum):
    SALARIED = "salaried"
    NON_SALARIED = "non_salaried"

class FilerStatus(str, Enum):
    FILER = "filer"
    NON_FILER = "non_filer"

class TaxCalculationRequest(BaseModel):
    annual_income: float = Field(..., gt=0, description="Annual income in Pakistani Rupees")
    taxpayer_type: TaxpayerType = Field(..., description="Type of taxpayer (salaried or non-salaried)")
    filer_status: FilerStatus = Field(default=FilerStatus.FILER, description="Tax filer status")
    
    @validator('annual_income')
    def validate_income(cls, v):
        if v < 0:
            raise ValueError('Annual income must be positive')
        if v > 100_000_000_000:  # 100 billion PKR - reasonable upper limit
            raise ValueError('Annual income exceeds maximum allowed limit')
        return v

class TaxSlabBreakdown(BaseModel):
    slab_range: str = Field(..., description="Income range for this tax slab")
    rate_percentage: float = Field(..., description="Tax rate percentage")
    taxable_amount: float = Field(..., description="Amount of income in this slab")
    tax_amount: float = Field(..., description="Tax calculated for this slab")

class TaxCalculationResponse(BaseModel):
    annual_income: float = Field(..., description="Input annual income")
    taxpayer_type: TaxpayerType = Field(..., description="Type of taxpayer")
    filer_status: FilerStatus = Field(..., description="Tax filer status")
    
    # Tax breakdown
    tax_slabs: List[TaxSlabBreakdown] = Field(..., description="Detailed breakdown by tax slabs")
    total_tax: float = Field(..., description="Total income tax calculated")
    additional_tax: float = Field(default=0, description="Additional tax for high earners (10% on income > 10M)")
    super_tax: float = Field(default=0, description="Super tax for very high earners")
    
    # Net amounts
    net_annual_income: float = Field(..., description="Income after tax")
    net_monthly_income: float = Field(..., description="Monthly income after tax")
    
    # Effective rates
    effective_tax_rate: float = Field(..., description="Effective tax rate percentage")
    marginal_tax_rate: float = Field(..., description="Marginal tax rate percentage")
    
    # Pakistani context
    currency: str = Field(default="PKR", description="Currency")
    tax_year: str = Field(default="2024-25", description="Pakistani tax year")

class ErrorResponse(BaseModel):
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")
    status_code: int = Field(..., description="HTTP status code") 