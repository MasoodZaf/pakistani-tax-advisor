import React, { useState } from "react";
import { Calculator, User, Lock, Mail } from "lucide-react";
import { getDefaultTaxData } from '../../utils/taxUtils';

const LoginRegister = ({ onLogin, users, setUsers }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: "", password: "", name: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = () => {
    setError("");
    setIsLoading(true);

    // Basic validation
    if (!formData.email || !formData.password) {
      setError("Please fill in all required fields");
      setIsLoading(false);
      return;
    }

    if (!isLogin && !formData.name) {
      setError("Please enter your full name");
      setIsLoading(false);
      return;
    }

    setTimeout(() => {
      if (isLogin) {
        const user = users.find(u => u.email.toLowerCase() === formData.email.toLowerCase() && u.password === formData.password);
        if (user) {
          onLogin(user);
        } else {
          setError("Invalid email or password");
        }
      } else {
        if (formData.password !== formData.confirmPassword) {
          setError("Passwords don't match");
          setIsLoading(false);
          return;
        }
        if (users.find(u => u.email === formData.email)) {
          setError("Email already exists");
          setIsLoading(false);
          return;
        }
        if (formData.password.length < 6) {
          setError("Password must be at least 6 characters");
          setIsLoading(false);
          return;
        }

        const newUser = {
          id: Date.now(),
          email: formData.email,
          name: formData.name,
          password: formData.password,
          role: formData.email === "admin@tax.pk" ? "admin" : "user",
          createdAt: new Date().toISOString(),
          taxData: getDefaultTaxData()
        };
        
        setUsers([...users, newUser]);
        onLogin(newUser);
      }
      setIsLoading(false);
    }, 100);
  };

  const quickLogin = (userEmail) => {
    const user = users.find(u => u.email === userEmail);
    if (user) {
      onLogin(user);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calculator className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Pakistani Tax Advisor</h1>
          <p className="text-gray-600 mt-2">{isLogin ? "Sign in to your account" : "Create your account"}</p>
        </div>

        <div className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <div className="relative">
                <User className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your full name"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your email"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your password"
              />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <div className="relative">
                <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Confirm your password"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Signing In...
              </>
            ) : (
              isLogin ? "Sign In" : "Create Account"
            )}
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
              setFormData({ email: "", password: "", name: "", confirmPassword: "" });
            }}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>

        {isLogin && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg text-xs text-gray-600">
            <p className="font-semibold mb-3">Demo Accounts:</p>
            
            <div className="space-y-3">
              <div className="bg-white p-3 rounded border">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">Admin Account</p>
                    <p className="text-xs">admin@tax.pk / admin123</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => quickLogin("admin@tax.pk")}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded"
                  >
                    Quick Login
                  </button>
                </div>
              </div>
              
              <div className="bg-white p-3 rounded border">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">Demo User</p>
                    <p className="text-xs">user@demo.pk / user123</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => quickLogin("user@demo.pk")}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded"
                  >
                    Quick Login
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginRegister; 