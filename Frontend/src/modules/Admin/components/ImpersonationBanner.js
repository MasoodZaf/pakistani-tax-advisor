import React, { useState } from 'react';
import { AlertTriangle, LogOut, User, Shield } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const ImpersonationBanner = ({ user, onEndImpersonation }) => {
  const [ending, setEnding] = useState(false);

  const handleEndImpersonation = async () => {
    if (ending) return;

    const confirmMessage = 'Are you sure you want to end the impersonation session and return to admin panel?';
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setEnding(true);
      
      const response = await axios.post('/api/admin/end-impersonation');
      
      if (response.data.success) {
        // Update session with admin token
        localStorage.setItem('sessionToken', response.data.data.sessionToken);
        localStorage.setItem('user', JSON.stringify(response.data.data.user));
        localStorage.removeItem('isImpersonation');
        localStorage.removeItem('impersonatedBy');
        
        toast.success('Returned to admin panel', {
          duration: 3000,
          icon: '🔄',
        });
        
        // Call the callback to update the UI
        if (onEndImpersonation) {
          onEndImpersonation(response.data.data);
        }
        
        // Reload to admin context
        setTimeout(() => {
          window.location.href = '/admin';
        }, 1000);
        
      } else {
        toast.error(response.data.message || 'Failed to end impersonation');
      }
    } catch (error) {
      console.error('End impersonation error:', error);
      toast.error(error.response?.data?.message || 'Failed to end impersonation');
    } finally {
      setEnding(false);
    }
  };

  // Check if we're in impersonation mode
  const isImpersonation = localStorage.getItem('isImpersonation') === 'true';
  const impersonatedBy = JSON.parse(localStorage.getItem('impersonatedBy') || '{}');

  if (!isImpersonation) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-red-600 to-red-700 text-white py-3 px-4 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-yellow-300 animate-pulse" />
            <Shield className="w-5 h-5" />
          </div>
          
          <div className="flex items-center space-x-6">
            <div>
              <span className="font-semibold">IMPERSONATION MODE</span>
              <span className="mx-2">•</span>
              <span className="opacity-90">
                Logged in as: <strong>{user?.name}</strong> ({user?.email})
              </span>
            </div>
            
            {impersonatedBy.name && (
              <div className="hidden md:block">
                <span className="text-red-200 text-sm">
                  Super Admin: {impersonatedBy.name} ({impersonatedBy.email})
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center text-red-200 text-sm">
            <User className="w-4 h-4 mr-1" />
            <span>All actions are logged</span>
          </div>
          
          <button
            onClick={handleEndImpersonation}
            disabled={ending}
            className="flex items-center px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {ending ? 'Ending...' : 'End Impersonation'}
          </button>
        </div>
      </div>
      
      {/* Mobile view for impersonated by info */}
      {impersonatedBy.name && (
        <div className="md:hidden mt-2 pt-2 border-t border-red-500 border-opacity-30">
          <span className="text-red-200 text-sm">
            Super Admin: {impersonatedBy.name} ({impersonatedBy.email})
          </span>
        </div>
      )}
    </div>
  );
};

export default ImpersonationBanner;