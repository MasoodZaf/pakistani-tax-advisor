"""
Pakistani Tax Calculator for 2024-25
Implements official tax slabs as per Federal Budget 2024-25
"""

from typing import List, Tuple
try:
    from backend.app.models.tax_models import TaxSlabBreakdown, TaxpayerType, FilerStatus
except ImportError:
    from app.models.tax_models import TaxSlabBreakdown, TaxpayerType, FilerStatus

class PakistaniTaxCalculator:
    """
    Pakistani Income Tax Calculator for Tax Year 2024-25
    Based on Federal Budget 2024-25 tax slabs
    """
    
    # Salaried Individual Tax Slabs 2024-25
    SALARIED_TAX_SLABS = [
        (600_000, 0.00),       # 0% up to Rs. 600,000
        (1_200_000, 0.05),     # 5% for Rs. 600,001 - Rs. 1,200,000
        (2_200_000, 0.15),     # 15% for Rs. 1,200,001 - Rs. 2,200,000
        (3_200_000, 0.25),     # 25% for Rs. 2,200,001 - Rs. 3,200,000
        (4_100_000, 0.30),     # 30% for Rs. 3,200,001 - Rs. 4,100,000
        (float('inf'), 0.35),  # 35% above Rs. 4,100,000
    ]
    
    # Non-Salaried Individual & AOP Tax Slabs 2024-25
    NON_SALARIED_TAX_SLABS = [
        (600_000, 0.00),       # 0% up to Rs. 600,000
        (1_200_000, 0.15),     # 15% for Rs. 600,001 - Rs. 1,200,000
        (1_600_000, 0.20),     # 20% for Rs. 1,200,001 - Rs. 1,600,000
        (3_200_000, 0.30),     # 30% for Rs. 1,600,001 - Rs. 3,200,000
        (5_600_000, 0.40),     # 40% for Rs. 3,200,001 - Rs. 5,600,000
        (float('inf'), 0.45),  # 45% above Rs. 5,600,000
    ]
    
    # Super Tax Slabs (for high earners)
    SUPER_TAX_SLABS = [
        (150_000_000, 0.00),   # 0% up to Rs. 150 million
        (200_000_000, 0.01),   # 1% for Rs. 150M - Rs. 200M
        (250_000_000, 0.02),   # 2% for Rs. 200M - Rs. 250M
        (300_000_000, 0.03),   # 3% for Rs. 250M - Rs. 300M
        (350_000_000, 0.04),   # 4% for Rs. 300M - Rs. 350M
        (400_000_000, 0.06),   # 6% for Rs. 350M - Rs. 400M
        (500_000_000, 0.08),   # 8% for Rs. 400M - Rs. 500M
        (float('inf'), 0.10),  # 10% above Rs. 500M
    ]
    
    def calculate_tax(
        self, 
        annual_income: float, 
        taxpayer_type: TaxpayerType,
        filer_status: FilerStatus = FilerStatus.FILER
    ) -> dict:
        """
        Calculate Pakistani income tax for 2024-25
        
        Args:
            annual_income: Annual income in PKR
            taxpayer_type: SALARIED or NON_SALARIED
            filer_status: FILER or NON_FILER
            
        Returns:
            Dictionary with detailed tax calculation
        """
        
        # Select appropriate tax slabs
        if taxpayer_type == TaxpayerType.SALARIED:
            tax_slabs = self.SALARIED_TAX_SLABS
        else:
            tax_slabs = self.NON_SALARIED_TAX_SLABS
        
        # Calculate basic income tax
        tax_breakdown, total_tax, marginal_rate = self._calculate_progressive_tax(
            annual_income, tax_slabs
        )
        
        # Calculate additional tax (10% for income > 10M)
        additional_tax = self._calculate_additional_tax(annual_income, total_tax)
        
        # Calculate super tax (for very high earners)
        super_tax = self._calculate_super_tax(annual_income)
        
        # Total tax liability
        total_tax_liability = total_tax + additional_tax + super_tax
        
        # Calculate net income
        net_annual_income = annual_income - total_tax_liability
        net_monthly_income = net_annual_income / 12
        
        # Calculate effective tax rate
        effective_tax_rate = (total_tax_liability / annual_income) * 100 if annual_income > 0 else 0
        
        return {
            "annual_income": annual_income,
            "taxpayer_type": taxpayer_type,
            "filer_status": filer_status,
            "tax_slabs": tax_breakdown,
            "total_tax": total_tax,
            "additional_tax": additional_tax,
            "super_tax": super_tax,
            "total_tax_liability": total_tax_liability,
            "net_annual_income": net_annual_income,
            "net_monthly_income": net_monthly_income,
            "effective_tax_rate": effective_tax_rate,
            "marginal_tax_rate": marginal_rate,
            "currency": "PKR",
            "tax_year": "2024-25"
        }
    
    def _calculate_progressive_tax(
        self, 
        income: float, 
        tax_slabs: List[Tuple[float, float]]
    ) -> Tuple[List[TaxSlabBreakdown], float, float]:
        """Calculate progressive tax using tax slabs"""
        
        tax_breakdown = []
        total_tax = 0
        remaining_income = income
        previous_threshold = 0
        marginal_rate = 0
        
        for threshold, rate in tax_slabs:
            if remaining_income <= 0:
                break
                
            # Calculate taxable amount in this slab
            if threshold == float('inf'):
                taxable_in_slab = remaining_income
                slab_range = f"Above Rs. {previous_threshold:,.0f}"
            else:
                taxable_in_slab = min(remaining_income, threshold - previous_threshold)
                if previous_threshold == 0:
                    slab_range = f"Up to Rs. {threshold:,.0f}"
                else:
                    slab_range = f"Rs. {previous_threshold:,.0f} - Rs. {threshold:,.0f}"
            
            # Calculate tax for this slab
            tax_in_slab = taxable_in_slab * rate
            total_tax += tax_in_slab
            
            # Add to breakdown if there's taxable income in this slab
            if taxable_in_slab > 0:
                tax_breakdown.append(TaxSlabBreakdown(
                    slab_range=slab_range,
                    rate_percentage=rate * 100,
                    taxable_amount=taxable_in_slab,
                    tax_amount=tax_in_slab
                ))
                marginal_rate = rate * 100  # Update marginal rate
            
            remaining_income -= taxable_in_slab
            previous_threshold = threshold
            
            if threshold == float('inf') or remaining_income <= 0:
                break
        
        return tax_breakdown, total_tax, marginal_rate
    
    def _calculate_additional_tax(self, annual_income: float, basic_tax: float) -> float:
        """
        Calculate additional 10% tax for income above Rs. 10 million
        """
        if annual_income > 10_000_000:
            return basic_tax * 0.10  # 10% of basic tax liability
        return 0
    
    def _calculate_super_tax(self, annual_income: float) -> float:
        """
        Calculate super tax for very high earners (above Rs. 150 million)
        """
        if annual_income <= 150_000_000:
            return 0
        
        _, super_tax, _ = self._calculate_progressive_tax(annual_income, self.SUPER_TAX_SLABS)
        return super_tax
    
    def get_tax_slabs_info(self, taxpayer_type: TaxpayerType) -> List[dict]:
        """Get tax slabs information for display"""
        
        if taxpayer_type == TaxpayerType.SALARIED:
            slabs = self.SALARIED_TAX_SLABS
        else:
            slabs = self.NON_SALARIED_TAX_SLABS
        
        slab_info = []
        previous_threshold = 0
        
        for threshold, rate in slabs:
            if threshold == float('inf'):
                range_desc = f"Above Rs. {previous_threshold:,.0f}"
            elif previous_threshold == 0:
                range_desc = f"Up to Rs. {threshold:,.0f}"
            else:
                range_desc = f"Rs. {previous_threshold:,.0f} - Rs. {threshold:,.0f}"
            
            slab_info.append({
                "range": range_desc,
                "rate": f"{rate * 100}%"
            })
            
            previous_threshold = threshold
            if threshold == float('inf'):
                break
        
        return slab_info

# Create a singleton instance
tax_calculator = PakistaniTaxCalculator() 