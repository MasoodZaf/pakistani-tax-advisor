import axios from 'axios';

// Base URL for the API - adjust based on your backend setup
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

// Create axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth tokens or other headers
api.interceptors.request.use(
  (config) => {
    // Add any authentication tokens here if needed
    // config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle different error types
    if (error.response) {
      // Server responded with error status
      console.error('API Error:', error.response.data);
      throw new Error(error.response.data.detail || 'Server error occurred');
    } else if (error.request) {
      // Network error
      console.error('Network Error:', error.request);
      throw new Error('Network error - please check your connection');
    } else {
      // Other error
      console.error('Error:', error.message);
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
);

/**
 * Calculate tax for salaried individual
 * @param {number} income - Annual income amount
 * @param {boolean} isFiler - Whether the person is a filer
 * @returns {Promise<object>} - Tax calculation result
 */
export const calculateSalariedTax = async (income, isFiler = true) => {
  try {
    const response = await api.post('/api/tax/calculate/salaried', {
      income: parseFloat(income),
      is_filer: isFiler
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Calculate tax for non-salaried individual
 * @param {number} income - Annual income amount
 * @param {boolean} isFiler - Whether the person is a filer
 * @returns {Promise<object>} - Tax calculation result
 */
export const calculateNonSalariedTax = async (income, isFiler = true) => {
  try {
    const response = await api.post('/api/tax/calculate/non-salaried', {
      income: parseFloat(income),
      is_filer: isFiler
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get tax slabs information
 * @param {string} taxType - Type of tax (salaried/non-salaried)
 * @returns {Promise<object>} - Tax slabs information
 */
export const getTaxSlabs = async (taxType = 'salaried') => {
  try {
    const response = await api.get(`/api/tax/slabs/${taxType}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Health check for the API
 * @returns {Promise<object>} - Health status
 */
export const healthCheck = async () => {
  try {
    const response = await api.get('/');
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Generic tax calculation function
 * @param {object} params - Calculation parameters
 * @param {number} params.income - Annual income
 * @param {string} params.taxType - Tax type (salaried/non-salaried)
 * @param {boolean} params.isFiler - Filer status
 * @returns {Promise<object>} - Tax calculation result
 */
export const calculateTax = async ({ income, taxType, isFiler = true }) => {
  const calculationFunction = taxType === 'salaried' 
    ? calculateSalariedTax 
    : calculateNonSalariedTax;
  
  return await calculationFunction(income, isFiler);
};

// Export the axios instance for custom requests
export { api };

// Export API base URL for use in other components
export { API_BASE_URL }; 