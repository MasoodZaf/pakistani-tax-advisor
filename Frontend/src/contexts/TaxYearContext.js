import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const TaxYearContext = createContext(null);

/**
 * TaxYearProvider — fetches the current active tax year from the backend once
 * on mount and makes it available to the entire app via useTaxYear().
 *
 * Falls back to '2025-26' only if the API is completely unreachable, so the
 * UI never hard-codes a year in business logic — the DB is always the source
 * of truth.
 */
export const TaxYearProvider = ({ children }) => {
  const [currentTaxYear, setCurrentTaxYear] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchTaxYear = async () => {
      try {
        const { data } = await axios.get('/api/tax-year/current');
        if (!cancelled && data.success) {
          setCurrentTaxYear(data.currentTaxYear);
          setAvailableYears(data.availableYears || [data.currentTaxYear]);
        } else if (!cancelled) {
          setError(data?.message || 'Tax year configuration unavailable');
        }
      } catch (err) {
        if (!cancelled) {
          // Fail loud — no hardcoded fallback. Missing tax-year config is an
          // operator-level issue; hiding it behind a fake year masks drift.
          const msg = err?.response?.data?.message || err?.message || 'Failed to load tax year';
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTaxYear();
    return () => { cancelled = true; };
  }, []);

  return (
    <TaxYearContext.Provider value={{ currentTaxYear, availableYears, loading, error }}>
      {children}
    </TaxYearContext.Provider>
  );
};

export const useTaxYear = () => {
  const ctx = useContext(TaxYearContext);
  if (!ctx) throw new Error('useTaxYear must be used inside <TaxYearProvider>');
  return ctx;
};

export default TaxYearContext;
