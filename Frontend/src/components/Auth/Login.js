import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff, Lock, Mail, UserCheck, Shield, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const Login = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [adminAssistedLogin, setAdminAssistedLogin] = useState(null);

  // Check for admin-assisted login on component mount
  useEffect(() => {
    const adminLoginData = localStorage.getItem('adminAssistedLogin');
    if (adminLoginData) {
      try {
        const loginData = JSON.parse(adminLoginData);
        const timeElapsed = Date.now() - loginData.timestamp;
        
        // Check if token is still valid (10 minutes = 600000ms)
        if (timeElapsed < 600000) {
          setAdminAssistedLogin(loginData);
          setFormData(prev => ({
            ...prev,
            email: loginData.email
          }));
          
          toast.success(`Ready to login as ${loginData.userName}`, {
            duration: 5000,
            icon: '🔑',
          });
        } else {
          // Clean up expired token
          localStorage.removeItem('adminAssistedLogin');
          toast.error('Admin bypass token has expired');
        }
      } catch (error) {
        console.error('Error parsing admin login data:', error);
        localStorage.removeItem('adminAssistedLogin');
      }
    }
  }, []);

  // Redirect if already logged in
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    // Skip password validation for admin-assisted login
    if (!adminAssistedLogin) {
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Prepare login data
      const loginData = {
        email: formData.email,
        password: formData.password || 'admin-bypass', // Dummy password for admin bypass
      };

      // Add admin bypass token if available
      if (adminAssistedLogin) {
        loginData.adminBypassToken = adminAssistedLogin.tempBypassToken;
      }

      const result = await login(loginData.email, loginData.password, loginData.adminBypassToken);
      
      if (result.success) {
        // Clean up admin assisted login data
        if (adminAssistedLogin) {
          localStorage.removeItem('adminAssistedLogin');
          toast.success(`Successfully logged in as ${adminAssistedLogin.userName}`, {
            duration: 4000,
            icon: '✅',
          });
        }
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Demo accounts for quick testing
  const demoAccounts = [
    {
      name: 'Super Admin',
      email: 'superadmin@paktaxadvisor.com',
      password: 'admin123',
      role: 'super_admin'
    },
    {
      name: 'Super Admin Alt',
      email: 'admin@test.com',
      password: 'admin123',
      role: 'super_admin'
    },
    {
      name: 'Test User Demo',
      email: 'testuser@paktaxadvisor.com',
      password: 'TestUser123',
      role: 'user'
    }
  ];

  const fillDemoAccount = (account) => {
    setFormData({
      email: account.email,
      password: account.password
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-2xl">PT</span>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Pakistani Tax Advisor System
          </p>
        </div>

        {/* Admin Assisted Login Banner */}
        {adminAssistedLogin && (
          <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Shield className="w-6 h-6 text-blue-600" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900">Admin-Assisted Login</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Super admin has pre-filled the email for <strong>{adminAssistedLogin.userName}</strong>
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Simply click "Sign In" to access this user's account
                </p>
              </div>
              <AlertTriangle className="w-5 h-5 text-blue-500" />
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="form-label">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`form-input pl-10 ${errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                  placeholder="Enter your email"
                />
              </div>
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="form-label">
                Password {adminAssistedLogin && <span className="text-gray-500 text-sm">(optional - admin bypass active)</span>}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`form-input pl-10 pr-10 ${errors.password ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                  placeholder={adminAssistedLogin ? "Password not required (admin bypass)" : "Enter your password"}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && <p className="form-error">{errors.password}</p>}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <a href="#" className="font-medium text-primary-600 hover:text-primary-500">
                Forgot your password?
              </a>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="spinner mr-2"></div>
              ) : (
                <UserCheck className="w-5 h-5 mr-2" />
              )}
              {loading ? 'Signing in...' : (adminAssistedLogin ? `Sign in as ${adminAssistedLogin.userName}` : 'Sign in')}
            </button>
          </div>
        </form>

        {/* Demo Accounts */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">Demo Accounts</span>
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            {demoAccounts.map((account, index) => (
              <button
                key={index}
                type="button"
                onClick={() => fillDemoAccount(account)}
                className="w-full text-left px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{account.name}</span>
                  <span className="text-xs text-gray-500 capitalize">{account.role.replace('_', ' ')}</span>
                </div>
                <div className="text-xs text-gray-600">{account.email}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Registration Link */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              Create a new account
            </Link>
          </p>
          <p className="text-xs text-gray-500 mt-2">
            For admin access, contact your system administrator
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;