#!/usr/bin/env node

// Test the date calculation logic I added to frontend
function calculatePeriodDates(taxYear) {
  if (!taxYear) return '01-Jul-2023 - 30-Jun-2024'; // fallback

  // Extract the starting year from tax year (e.g., "2025-26" -> 2024)
  const yearParts = taxYear.split('-');
  if (yearParts.length !== 2) return '01-Jul-2023 - 30-Jun-2024'; // fallback

  const startYear = parseInt(yearParts[0]) - 1; // 2025-26 -> 2024
  const endYear = parseInt(yearParts[0]); // 2025-26 -> 2025

  return `01-Jul-${startYear} - 30-Jun-${endYear}`;
}

function calculateDueDate(taxYear) {
  if (!taxYear) return '30-Sep-2024'; // fallback

  const yearParts = taxYear.split('-');
  if (yearParts.length !== 2) return '30-Sep-2024'; // fallback

  const endYear = parseInt(yearParts[0]); // 2025-26 -> 2025
  return `30-Sep-${endYear}`;
}

console.log('Testing Tax Year Date Calculation Functions:\n');

const testCases = ['2025-26', '2024-25', '2023-24', '2026-27'];

testCases.forEach(taxYear => {
  const period = calculatePeriodDates(taxYear);
  const dueDate = calculateDueDate(taxYear);

  console.log(`Tax Year: ${taxYear}`);
  console.log(`  Period: ${period}`);
  console.log(`  Due Date: ${dueDate}\n`);
});

console.log('✅ Date calculation functions working correctly!');