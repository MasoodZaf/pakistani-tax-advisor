"""
API Routes for Pakistani Tax Calculator
Provides endpoints for tax calculations and tax information
"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from typing import List, Dict

try:
    from backend.app.models.tax_models import (
        TaxCalculationRequest,
        TaxCalculationResponse,
        TaxpayerType,
        ErrorResponse
    )
    from backend.app.core.tax_calculator import tax_calculator
except ImportError:
    from app.models.tax_models import (
        TaxCalculationRequest,
        TaxCalculationResponse,
        TaxpayerType,
        ErrorResponse
    )
    from app.core.tax_calculator import tax_calculator

router = APIRouter(prefix="/api/v1/tax", tags=["Tax Calculator"])

@router.post(
    "/calculate",
    response_model=TaxCalculationResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate Pakistani Income Tax",
    description="Calculate income tax for Pakistan 2024-25 based on taxpayer type and income",
    responses={
        200: {"description": "Tax calculation successful"},
        400: {"description": "Invalid input data", "model": ErrorResponse},
        422: {"description": "Validation error", "model": ErrorResponse},
        500: {"description": "Internal server error", "model": ErrorResponse}
    }
)
async def calculate_tax(request: TaxCalculationRequest):
    """
    Calculate Pakistani income tax for 2024-25
    
    **Parameters:**
    - **annual_income**: Annual income in Pakistani Rupees (must be positive)
    - **taxpayer_type**: Type of taxpayer (salaried or non_salaried)
    - **filer_status**: Tax filer status (filer or non_filer)
    
    **Returns:**
    - Detailed tax calculation with breakdown by slabs
    - Net income after tax
    - Effective and marginal tax rates
    - Additional taxes if applicable
    """
    try:
        # Calculate tax using the core calculator
        result = tax_calculator.calculate_tax(
            annual_income=request.annual_income,
            taxpayer_type=request.taxpayer_type,
            filer_status=request.filer_status
        )
        
        # Convert to response model
        return TaxCalculationResponse(**result)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid input: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@router.get(
    "/slabs/{taxpayer_type}",
    response_model=List[Dict],
    summary="Get Tax Slabs Information",
    description="Get current tax slabs for the specified taxpayer type",
    responses={
        200: {"description": "Tax slabs retrieved successfully"},
        400: {"description": "Invalid taxpayer type", "model": ErrorResponse}
    }
)
async def get_tax_slabs(taxpayer_type: TaxpayerType):
    """
    Get tax slabs information for 2024-25
    
    **Parameters:**
    - **taxpayer_type**: Type of taxpayer (salaried or non_salaried)
    
    **Returns:**
    - List of tax slabs with ranges and rates
    """
    try:
        slabs = tax_calculator.get_tax_slabs_info(taxpayer_type)
        return slabs
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving tax slabs: {str(e)}"
        )

@router.get(
    "/info",
    response_model=Dict,
    summary="Get Tax Calculator Information",
    description="Get general information about the Pakistani tax calculator"
)
async def get_tax_info():
    """
    Get Pakistani tax calculator information
    
    **Returns:**
    - Tax year information
    - Supported taxpayer types
    - Currency and other metadata
    """
    return {
        "tax_year": "2024-25",
        "currency": "PKR",
        "country": "Pakistan",
        "supported_taxpayer_types": [
            {"value": "salaried", "label": "Salaried Individual"},
            {"value": "non_salaried", "label": "Non-Salaried Individual & AOP"}
        ],
        "filer_statuses": [
            {"value": "filer", "label": "Tax Filer"},
            {"value": "non_filer", "label": "Non-Filer"}
        ],
        "features": [
            "Progressive tax calculation",
            "Additional tax for high earners (>10M)",
            "Super tax for very high earners (>150M)",
            "Detailed slab-wise breakdown",
            "Effective and marginal tax rates"
        ],
        "notes": [
            "Tax rates based on Federal Budget 2024-25",
            "Additional 10% tax applies to income above Rs. 10 million",
            "Super tax applies to income above Rs. 150 million",
            "All amounts are in Pakistani Rupees (PKR)"
        ]
    }

@router.post(
    "/calculate/simple",
    response_model=Dict,
    summary="Simple Tax Calculation",
    description="Simplified tax calculation endpoint for quick calculations"
)
async def calculate_tax_simple(
    annual_income: float,
    taxpayer_type: TaxpayerType = TaxpayerType.SALARIED
):
    """
    Quick tax calculation with minimal parameters
    
    **Parameters:**
    - **annual_income**: Annual income in PKR
    - **taxpayer_type**: Type of taxpayer (defaults to salaried)
    
    **Returns:**
    - Simplified tax calculation result
    """
    try:
        if annual_income <= 0:
            raise ValueError("Annual income must be positive")
        
        result = tax_calculator.calculate_tax(
            annual_income=annual_income,
            taxpayer_type=taxpayer_type
        )
        
        # Return simplified response
        return {
            "annual_income": result["annual_income"],
            "total_tax": result["total_tax_liability"],
            "net_income": result["net_annual_income"],
            "monthly_net_income": result["net_monthly_income"],
            "effective_tax_rate": f"{result['effective_tax_rate']:.2f}%",
            "taxpayer_type": taxpayer_type.value,
            "currency": "PKR"
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Calculation error: {str(e)}"
        ) 