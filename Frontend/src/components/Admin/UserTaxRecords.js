import React, { useState, useEffect } from 'react';
import { FileText, Edit, Save, X, User, Calendar, TrendingUp, DollarSign, CheckCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const UserTaxRecords = ({ userId, userName, onClose }) => {
  const [userTaxData, setUserTaxData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingForm, setEditingForm] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUserTaxRecords();
  }, [userId]);

  const fetchUserTaxRecords = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/admin/users/${userId}/tax-records`);
      if (response.data.success) {
        setUserTaxData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching user tax records:', error);
      toast.error('Failed to load user tax records');
    } finally {
      setLoading(false);
    }
  };

  const handleEditForm = (formType, currentData) => {
    setEditingForm(formType);
    setFormData(currentData || {});
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveForm = async () => {
    setSaving(true);
    
    try {
      const response = await axios.put(
        `/api/admin/users/${userId}/tax-forms/${editingForm}`,
        formData
      );
      
      if (response.data.success) {
        toast.success(`${editingForm} form updated successfully`);
        setEditingForm(null);
        fetchUserTaxRecords(); // Refresh data
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update form');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'PKR 0';
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <div className="spinner"></div>
            <span>Loading tax records...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!userTaxData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <p className="text-red-600">Failed to load user tax records</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-500 text-white rounded">
            Close
          </button>
        </div>
      </div>
    );
  }

  const { user, tax_returns, current_year_forms, summary } = userTaxData;
  const currentReturn = tax_returns.find(tr => tr.is_current);

  // Parse form data for easier access
  const formsData = {};
  if (current_year_forms) {
    current_year_forms.forEach(form => {
      formsData[form.form_type] = form;
    });
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b bg-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <User className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">{user.name} - Tax Records</h2>
                <p className="text-gray-600">{user.email} • Tax Consultant View</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2 mb-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Total Returns</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">{summary.total_returns}</div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">Completed</span>
              </div>
              <div className="text-2xl font-bold text-green-900">{summary.completed_returns}</div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex items-center space-x-2 mb-2">
                <Edit className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-900">Draft</span>
              </div>
              <div className="text-2xl font-bold text-yellow-900">{summary.draft_returns}</div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">Progress</span>
              </div>
              <div className="text-2xl font-bold text-purple-900">{summary.current_year_completion || 0}%</div>
            </div>
          </div>

          {/* Current Year Tax Return */}
          {currentReturn && (
            <div className="bg-white border rounded-lg mb-6">
              <div className="p-4 border-b bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">
                  Current Tax Year: {currentReturn.tax_year}
                </h3>
                <p className="text-gray-600">
                  Return #{currentReturn.return_number} • Status: {currentReturn.filing_status}
                </p>
              </div>

              {/* Editable Forms */}
              <div className="p-4 space-y-6">
                {/* Income Form */}
                <div className="border rounded-lg">
                  <div className="p-4 border-b bg-blue-50 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">Income Information</h4>
                    {editingForm === 'income' ? (
                      <div className="space-x-2">
                        <button
                          onClick={handleSaveForm}
                          disabled={saving}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                        >
                          {saving ? <div className="spinner w-4 h-4"></div> : <Save className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setEditingForm(null)}
                          className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditForm('income', formsData.income)}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="p-4">
                    {editingForm === 'income' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Salary Income (PKR)
                          </label>
                          <input
                            type="number"
                            name="salary_income"
                            value={formData.salary_income || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Business Income (PKR)
                          </label>
                          <input
                            type="number"
                            name="business_income"
                            value={formData.business_income || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Rental Income (PKR)
                          </label>
                          <input
                            type="number"
                            name="rental_income"
                            value={formData.rental_income || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Other Income (PKR)
                          </label>
                          <input
                            type="number"
                            name="other_income"
                            value={formData.other_income || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Employer Name
                          </label>
                          <input
                            type="text"
                            name="employer_name"
                            value={formData.employer_name || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Employer NTN
                          </label>
                          <input
                            type="text"
                            name="employer_ntn"
                            value={formData.employer_ntn || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm text-gray-600">Salary Income:</span>
                          <div className="font-medium">{formatCurrency(formsData.income?.salary_income)}</div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Business Income:</span>
                          <div className="font-medium">{formatCurrency(formsData.income?.business_income)}</div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Rental Income:</span>
                          <div className="font-medium">{formatCurrency(formsData.income?.rental_income)}</div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Other Income:</span>
                          <div className="font-medium">{formatCurrency(formsData.income?.other_income)}</div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Employer:</span>
                          <div className="font-medium">{formsData.income?.employer_name || 'Not specified'}</div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Employer NTN:</span>
                          <div className="font-medium">{formsData.income?.employer_ntn || 'Not specified'}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Similar pattern for Deductions and Final Tax forms */}
                {/* Deductions Form */}
                <div className="border rounded-lg">
                  <div className="p-4 border-b bg-green-50 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">Deductions & Allowances</h4>
                    {editingForm === 'deductions' ? (
                      <div className="space-x-2">
                        <button
                          onClick={handleSaveForm}
                          disabled={saving}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                        >
                          {saving ? <div className="spinner w-4 h-4"></div> : <Save className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setEditingForm(null)}
                          className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditForm('deductions', formsData.deductions)}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="p-4">
                    {editingForm === 'deductions' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Zakat Paid (PKR)
                          </label>
                          <input
                            type="number"
                            name="zakat_paid"
                            value={formData.zakat_paid || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Donations (PKR)
                          </label>
                          <input
                            type="number"
                            name="donations"
                            value={formData.donations || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Medical Expenses (PKR)
                          </label>
                          <input
                            type="number"
                            name="medical_expenses"
                            value={formData.medical_expenses || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Education Expenses (PKR)
                          </label>
                          <input
                            type="number"
                            name="education_expenses"
                            value={formData.education_expenses || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm text-gray-600">Zakat Paid:</span>
                          <div className="font-medium">{formatCurrency(formsData.deductions?.zakat_paid)}</div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Donations:</span>
                          <div className="font-medium">{formatCurrency(formsData.deductions?.donations)}</div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Medical Expenses:</span>
                          <div className="font-medium">{formatCurrency(formsData.deductions?.medical_expenses)}</div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Education Expenses:</span>
                          <div className="font-medium">{formatCurrency(formsData.deductions?.education_expenses)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tax Liability Form */}
                <div className="border rounded-lg">
                  <div className="p-4 border-b bg-purple-50 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">Tax Calculation & Payment</h4>
                    {editingForm === 'final_tax' ? (
                      <div className="space-x-2">
                        <button
                          onClick={handleSaveForm}
                          disabled={saving}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                        >
                          {saving ? <div className="spinner w-4 h-4"></div> : <Save className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setEditingForm(null)}
                          className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditForm('final_tax', formsData.final_tax)}
                        className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="p-4">
                    {editingForm === 'final_tax' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Total Tax Liability (PKR)
                          </label>
                          <input
                            type="number"
                            name="total_tax_liability"
                            value={formData.total_tax_liability || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Advance Tax Paid (PKR)
                          </label>
                          <input
                            type="number"
                            name="advance_tax_paid"
                            value={formData.advance_tax_paid || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Withholding Tax (PKR)
                          </label>
                          <input
                            type="number"
                            name="withholding_tax"
                            value={formData.withholding_tax || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Refund Due (PKR)
                          </label>
                          <input
                            type="number"
                            name="refund_due"
                            value={formData.refund_due || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm text-gray-600">Total Tax Liability:</span>
                          <div className="font-medium">{formatCurrency(formsData.final_tax?.total_tax_liability)}</div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Advance Tax Paid:</span>
                          <div className="font-medium">{formatCurrency(formsData.final_tax?.advance_tax_paid)}</div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Withholding Tax:</span>
                          <div className="font-medium">{formatCurrency(formsData.final_tax?.withholding_tax)}</div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Refund Due:</span>
                          <div className="font-medium">{formatCurrency(formsData.final_tax?.refund_due)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* All Tax Returns History */}
          <div className="bg-white border rounded-lg">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">Tax Returns History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tax Year
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Return Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tax Liability
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tax_returns.map((taxReturn) => (
                    <tr key={taxReturn.id} className={taxReturn.is_current ? 'bg-blue-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="font-medium text-gray-900">{taxReturn.tax_year}</span>
                          {taxReturn.is_current && (
                            <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                              Current
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {taxReturn.return_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          taxReturn.filing_status === 'submitted' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {taxReturn.filing_status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(taxReturn.total_tax_liability)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(taxReturn.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserTaxRecords;