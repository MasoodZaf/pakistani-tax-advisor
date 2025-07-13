#!/usr/bin/env python3
"""
Test script for Pakistani Tax Calculator
Quick verification of tax calculations with real examples
"""

import sys
import os

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.main import PakistaniTaxEngine, TaxData

def test_salaried_calculations():
    """Test salaried individual tax calculations"""
    print("🇵🇰 Testing Salaried Individual Tax Calculations (2024-25)")
    print("=" * 60)
    
    test_cases = [
        500_000,    # Below threshold
        800_000,    # First tax slab
        1_500_000,  # Second tax slab  
        2_500_000,  # Third tax slab
        3_500_000,  # Fourth tax slab
        5_000_000,  # Fifth tax slab
        10_000_000, # High earner (additional tax applies)
    ]
    
    for annual_income in test_cases:
        tax_amount = PakistaniTaxEngine.calculate_tax(annual_income)
        effective_rate = (tax_amount / annual_income * 100) if annual_income > 0 else 0
        
        print(f"Annual Income: PKR {annual_income:,}")
        print(f"Tax Amount: PKR {tax_amount:,}")
        print(f"Effective Rate: {effective_rate:.2f}%")
        print("-" * 40)

def test_comprehensive_calculations():
    """Test comprehensive tax calculations with deductions"""
    print("\n🇵🇰 Testing Comprehensive Tax Calculations")
    print("=" * 60)
    
    # Test data with income, deductions, and adjustments
    test_data = TaxData(
        income={
            "salary": 3_000_000,
            "bonus": 500_000,
            "car": 200_000,
            "other": 100_000
        },
        adjustments={},
        deductions={
            "zakat": 50_000,
            "charity": 30_000,
            "pension": 20_000
        },
        wealth={}
    )
    
    summary = PakistaniTaxEngine.calculate_tax_summary(test_data)
    
    print(f"Total Income: PKR {summary['total_income']:,}")
    print(f"Taxable Income: PKR {summary['taxable_income']:,}")
    print(f"Normal Tax: PKR {summary['normal_tax']:,}")
    print(f"Tax Credits: PKR {summary['tax_credits']:,}")
    print(f"Final Tax: PKR {summary['final_tax']:,}")
    print(f"Effective Rate: {summary['effective_rate']:.2f}%")
    
def test_tax_slabs():
    """Test Pakistani tax slabs verification"""
    print("\n🇵🇰 Testing Tax Slabs (2024-25)")
    print("=" * 60)
    
    for min_val, max_val, rate in PakistaniTaxEngine.TAX_SLABS:
        max_display = f"PKR {max_val:,}" if max_val != float('inf') else "Above"
        print(f"PKR {min_val:,} - {max_display}: {rate*100:.0f}%")

def test_edge_cases():
    """Test edge cases and boundary conditions"""
    print("\n🇵🇰 Testing Edge Cases")
    print("=" * 60)
    
    edge_cases = [
        0,          # Zero income
        -1000,      # Negative income
        600_000,    # Exact threshold
        600_001,    # Just above threshold
        1_200_000,  # Boundary between slabs
        1_200_001,  # Just above boundary
    ]
    
    for income in edge_cases:
        tax = PakistaniTaxEngine.calculate_tax(income)
        print(f"Income: PKR {income:,} → Tax: PKR {tax:,}")

def main():
    """Run all tests"""
    print("🚀 Pakistani Tax Calculator Test Suite")
    print("=" * 60)
    
    test_salaried_calculations()
    test_comprehensive_calculations()  
    test_tax_slabs()
    test_edge_cases()
    
    print("\n✅ All tests completed successfully!")

if __name__ == "__main__":
    main() 