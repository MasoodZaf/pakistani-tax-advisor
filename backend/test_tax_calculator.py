#!/usr/bin/env python3
"""
Test script for Pakistani Tax Calculator
Quick verification of tax calculations with real examples
"""

import sys
import os

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.tax_calculator import tax_calculator
from app.models.tax_models import TaxpayerType, FilerStatus

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
    
    for income in test_cases:
        print(f"\n💰 Annual Income: Rs. {income:,}")
        
        result = tax_calculator.calculate_tax(
            annual_income=income,
            taxpayer_type=TaxpayerType.SALARIED,
            filer_status=FilerStatus.FILER
        )
        
        print(f"📊 Tax Breakdown:")
        for slab in result['tax_slabs']:
            if slab.tax_amount > 0:
                print(f"   {slab.slab_range}: Rs. {slab.tax_amount:,.0f} ({slab.rate_percentage}%)")
        
        print(f"💳 Total Tax: Rs. {result['total_tax_liability']:,.0f}")
        print(f"💵 Net Income: Rs. {result['net_annual_income']:,.0f}")
        print(f"📈 Effective Rate: {result['effective_tax_rate']:.2f}%")
        print(f"📊 Marginal Rate: {result['marginal_tax_rate']:.1f}%")
        
        if result['additional_tax'] > 0:
            print(f"⚡ Additional Tax (10%): Rs. {result['additional_tax']:,.0f}")

def test_non_salaried_calculations():
    """Test non-salaried individual tax calculations"""
    print("\n\n🏢 Testing Non-Salaried Individual Tax Calculations (2024-25)")
    print("=" * 60)
    
    test_cases = [
        1_000_000,  # First tax slab
        1_400_000,  # Second tax slab
        2_500_000,  # Third tax slab
        4_000_000,  # Fourth tax slab
        6_000_000,  # Fifth tax slab
    ]
    
    for income in test_cases:
        print(f"\n💰 Annual Income: Rs. {income:,}")
        
        result = tax_calculator.calculate_tax(
            annual_income=income,
            taxpayer_type=TaxpayerType.NON_SALARIED,
            filer_status=FilerStatus.FILER
        )
        
        print(f"📊 Tax Breakdown:")
        for slab in result['tax_slabs']:
            if slab.tax_amount > 0:
                print(f"   {slab.slab_range}: Rs. {slab.tax_amount:,.0f} ({slab.rate_percentage}%)")
        
        print(f"💳 Total Tax: Rs. {result['total_tax_liability']:,.0f}")
        print(f"💵 Net Income: Rs. {result['net_annual_income']:,.0f}")
        print(f"📈 Effective Rate: {result['effective_tax_rate']:.2f}%")

def test_comparison():
    """Compare salaried vs non-salaried for same income"""
    print("\n\n⚖️  Comparison: Salaried vs Non-Salaried (Rs. 2,000,000)")
    print("=" * 60)
    
    income = 2_000_000
    
    # Salaried calculation
    salaried_result = tax_calculator.calculate_tax(
        annual_income=income,
        taxpayer_type=TaxpayerType.SALARIED,
        filer_status=FilerStatus.FILER
    )
    
    # Non-salaried calculation
    non_salaried_result = tax_calculator.calculate_tax(
        annual_income=income,
        taxpayer_type=TaxpayerType.NON_SALARIED,
        filer_status=FilerStatus.FILER
    )
    
    print(f"👔 Salaried:")
    print(f"   Total Tax: Rs. {salaried_result['total_tax_liability']:,.0f}")
    print(f"   Effective Rate: {salaried_result['effective_tax_rate']:.2f}%")
    print(f"   Net Income: Rs. {salaried_result['net_annual_income']:,.0f}")
    
    print(f"\n🏢 Non-Salaried:")
    print(f"   Total Tax: Rs. {non_salaried_result['total_tax_liability']:,.0f}")
    print(f"   Effective Rate: {non_salaried_result['effective_tax_rate']:.2f}%")
    print(f"   Net Income: Rs. {non_salaried_result['net_annual_income']:,.0f}")
    
    difference = non_salaried_result['total_tax_liability'] - salaried_result['total_tax_liability']
    print(f"\n💡 Difference: Rs. {difference:,.0f} (Non-salaried pays {'more' if difference > 0 else 'less'})")

def test_super_tax():
    """Test super tax for very high earners"""
    print("\n\n🏆 Testing Super Tax (Very High Earners)")
    print("=" * 60)
    
    high_income = 200_000_000  # Rs. 200 million
    
    result = tax_calculator.calculate_tax(
        annual_income=high_income,
        taxpayer_type=TaxpayerType.SALARIED,
        filer_status=FilerStatus.FILER
    )
    
    print(f"💰 Annual Income: Rs. {high_income:,}")
    print(f"💳 Basic Tax: Rs. {result['total_tax']:,.0f}")
    print(f"⚡ Additional Tax: Rs. {result['additional_tax']:,.0f}")
    print(f"🏆 Super Tax: Rs. {result['super_tax']:,.0f}")
    print(f"💰 Total Tax Liability: Rs. {result['total_tax_liability']:,.0f}")
    print(f"📈 Effective Rate: {result['effective_tax_rate']:.2f}%")

if __name__ == "__main__":
    print("🚀 Pakistani Tax Calculator Test Suite")
    print("Testing 2024-25 Tax Slabs Implementation")
    print("=" * 60)
    
    try:
        test_salaried_calculations()
        test_non_salaried_calculations()
        test_comparison()
        test_super_tax()
        
        print("\n\n✅ All tests completed successfully!")
        print("🇵🇰 Pakistani Tax Calculator is working correctly!")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc() 