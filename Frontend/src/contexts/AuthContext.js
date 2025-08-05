import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

// Set axios defaults for API base URL
axios.defaults.baseURL = 'http://localhost:3001';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // Set up axios interceptors
  useEffect(() => {
    // Request interceptor to add auth token
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle auth errors
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        // Only trigger logout for 401 errors that are NOT login attempts
        if (error.response?.status === 401 && !error.config?.url?.includes('/login')) {
          logout();
          toast.error('Session expired. Please login again.');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // Check if user is logged in on app start
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await axios.post('/api/verify-session', {
        sessionToken: token
      });
      setUser(response.data.user);
    } catch (error) {
      localStorage.removeItem('token');
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, adminBypassToken = null) => {
    try {
      console.log('AuthContext: Attempting login for', email);
      console.log('AuthContext: Password length:', password?.length);
      
      const loginPayload = {
        email,
        password,
      };

      // Add admin bypass token if provided
      if (adminBypassToken) {
        loginPayload.adminBypassToken = adminBypassToken;
        console.log('AuthContext: Using admin bypass token');
      }
      
      console.log('AuthContext: Making request to /api/login with payload:', {
        ...loginPayload,
        password: '[REDACTED]'
      });
      
      // Debug: Log password details for super admin accounts
      if (email.includes('admin')) {
        console.log('AuthContext: SUPER ADMIN DEBUG - Password char codes:', 
          Array.from(password).map(char => char.charCodeAt(0)));
        console.log('AuthContext: SUPER ADMIN DEBUG - Password exact string:', JSON.stringify(password));
        console.log('AuthContext: SUPER ADMIN DEBUG - Password length and trimmed:', password.length, JSON.stringify(password.trim()));
      }
      
      const response = await axios.post('/api/login', loginPayload);

      console.log('AuthContext: Login response received', response.status);
      
      if (response.data && response.data.success) {
        const { sessionToken, user: userData } = response.data;
        
        console.log('AuthContext: Login successful, storing token');
        localStorage.setItem('token', sessionToken);
        setUser(userData);
        
        toast.success(`Welcome back, ${userData.name}!`);
        return { success: true };
      } else {
        console.log('AuthContext: Login response indicates failure', response.data);
        const message = response.data?.error || 'Login failed';
        toast.error(message);
        return { success: false, error: message };
      }
    } catch (error) {
      console.error('AuthContext: Login error', error);
      console.log('AuthContext: Error response status:', error.response?.status);
      console.log('AuthContext: Error response data:', error.response?.data);
      console.log('AuthContext: Error message:', error.message);
      
      const message = error.response?.data?.error || error.message || 'Login failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post('/api/register', userData);
      
      const { token, user: newUser } = response.data;
      
      localStorage.setItem('token', token);
      setUser(newUser);
      
      toast.success(`Welcome, ${newUser.name}!`);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    toast.success('Logged out successfully');
  };

  const updateUser = (userData) => {
    setUser(prev => ({ ...prev, ...userData }));
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    checkAuthStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};