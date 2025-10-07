import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const PersonalInfoForm = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentTaxYear, setCurrentTaxYear] = useState('2025-26');

  const [formData, setFormData] = useState({
    full_name: '',
    father_name: '',
    cnic: '',
    ntn: '',
    passport_number: '',
    residential_address: '',
    mailing_address: '',
    city: '',
    province: '',
    postal_code: '',
    country: 'Pakistan',
    mobile_number: '',
    landline_number: '',
    email_address: '',
    profession: '',
    employer_name: '',
    employer_address: '',
    employer_ntn: '',
    fbr_registration_number: '',
    tax_circle: '',
    zone: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchPersonalInfo();
  }, []);

  const fetchPersonalInfo = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/personal-info/${currentTaxYear}`);

      if (response.data.success && response.data.data) {
        // User has already filled the form, redirect to dashboard
        toast.success('Personal information already submitted');
        navigate('/dashboard');
      } else {
        // Pre-fill with user data
        setFormData(prev => ({
          ...prev,
          full_name: user?.name || '',
          email_address: user?.email || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching personal info:', error);
      // If error, assume no data exists and show form
      setFormData(prev => ({
        ...prev,
        full_name: user?.name || '',
        email_address: user?.email || ''
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields
    if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required';
    if (!formData.father_name.trim()) newErrors.father_name = "Father's name is required";
    if (!formData.cnic.trim()) newErrors.cnic = 'CNIC is required';
    if (!formData.ntn.trim()) newErrors.ntn = 'NTN is required';
    if (!formData.residential_address.trim()) newErrors.residential_address = 'Residential address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.province.trim()) newErrors.province = 'Province is required';
    if (!formData.mobile_number.trim()) newErrors.mobile_number = 'Mobile number is required';
    if (!formData.email_address.trim()) newErrors.email_address = 'Email address is required';

    // CNIC format validation (13 digits)
    if (formData.cnic && !/^\d{13}$/.test(formData.cnic.replace(/-/g, ''))) {
      newErrors.cnic = 'CNIC must be 13 digits (format: XXXXXXXXXXXXX or XXXXX-XXXXXXX-X)';
    }

    // NTN format validation (7 digits)
    if (formData.ntn && !/^\d{7}$/.test(formData.ntn.replace(/-/g, ''))) {
      newErrors.ntn = 'NTN must be 7 digits';
    }

    // Mobile number validation (Pakistani format)
    if (formData.mobile_number && !/^((\+92)|(0092)|(92)|(0))[3][0-9]{9}$/.test(formData.mobile_number.replace(/-/g, ''))) {
      newErrors.mobile_number = 'Invalid Pakistani mobile number (e.g., 03001234567)';
    }

    // Email validation
    if (formData.email_address && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email_address)) {
      newErrors.email_address = 'Invalid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    try {
      setSaving(true);
      const response = await axios.post(`/api/personal-info/${currentTaxYear}`, formData);

      if (response.data.success) {
        toast.success('Personal information saved successfully!');
        navigate('/dashboard');
      } else {
        toast.error(response.data.message || 'Failed to save personal information');
      }
    } catch (error) {
      console.error('Error saving personal info:', error);
      toast.error(error.response?.data?.message || 'Failed to save personal information');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyAddress = () => {
    setFormData(prev => ({
      ...prev,
      mailing_address: prev.residential_address
    }));
    toast.success('Residential address copied to mailing address');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading personal information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Personal Information
            </h1>
            <p className="text-gray-600">
              Please provide your personal details as per FBR requirements. This information will be used for tax filing.
            </p>
            <div className="mt-2 px-4 py-2 bg-blue-50 border-l-4 border-blue-500 text-blue-700">
              <p className="text-sm font-medium">
                Tax Year: {currentTaxYear}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Personal Details Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b pb-2">
                Personal Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                      errors.full_name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter your full name"
                  />
                  {errors.full_name && (
                    <p className="text-red-500 text-xs mt-1">{errors.full_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Father's Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="father_name"
                    value={formData.father_name}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                      errors.father_name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter father's name"
                  />
                  {errors.father_name && (
                    <p className="text-red-500 text-xs mt-1">{errors.father_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CNIC <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="cnic"
                    value={formData.cnic}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                      errors.cnic ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="XXXXX-XXXXXXX-X"
                    maxLength="15"
                  />
                  {errors.cnic && (
                    <p className="text-red-500 text-xs mt-1">{errors.cnic}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    NTN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="ntn"
                    value={formData.ntn}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                      errors.ntn ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="XXXXXXX"
                    maxLength="7"
                  />
                  {errors.ntn && (
                    <p className="text-red-500 text-xs mt-1">{errors.ntn}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Passport Number
                  </label>
                  <input
                    type="text"
                    name="passport_number"
                    value={formData.passport_number}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            {/* Address Information Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b pb-2">
                Address Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Residential Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="residential_address"
                    value={formData.residential_address}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                      errors.residential_address ? 'border-red-500' : 'border-gray-300'
                    }`}
                    rows="2"
                    placeholder="Enter complete residential address"
                  />
                  {errors.residential_address && (
                    <p className="text-red-500 text-xs mt-1">{errors.residential_address}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Mailing Address
                    </label>
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Copy from Residential
                    </button>
                  </div>
                  <textarea
                    name="mailing_address"
                    value={formData.mailing_address}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    rows="2"
                    placeholder="Enter mailing address (if different)"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                        errors.city ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="City"
                    />
                    {errors.city && (
                      <p className="text-red-500 text-xs mt-1">{errors.city}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Province <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="province"
                      value={formData.province}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                        errors.province ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select Province</option>
                      <option value="Punjab">Punjab</option>
                      <option value="Sindh">Sindh</option>
                      <option value="Khyber Pakhtunkhwa">Khyber Pakhtunkhwa</option>
                      <option value="Balochistan">Balochistan</option>
                      <option value="Islamabad Capital Territory">Islamabad Capital Territory</option>
                      <option value="Gilgit-Baltistan">Gilgit-Baltistan</option>
                      <option value="Azad Jammu and Kashmir">Azad Jammu and Kashmir</option>
                    </select>
                    {errors.province && (
                      <p className="text-red-500 text-xs mt-1">{errors.province}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      name="postal_code"
                      value={formData.postal_code}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      placeholder="Postal Code"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Country"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b pb-2">
                Contact Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="mobile_number"
                    value={formData.mobile_number}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                      errors.mobile_number ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="03001234567"
                  />
                  {errors.mobile_number && (
                    <p className="text-red-500 text-xs mt-1">{errors.mobile_number}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Landline Number
                  </label>
                  <input
                    type="tel"
                    name="landline_number"
                    value={formData.landline_number}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email_address"
                    value={formData.email_address}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                      errors.email_address ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="email@example.com"
                  />
                  {errors.email_address && (
                    <p className="text-red-500 text-xs mt-1">{errors.email_address}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Professional Information Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b pb-2">
                Professional Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Profession
                  </label>
                  <input
                    type="text"
                    name="profession"
                    value={formData.profession}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Your profession/occupation"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Employer Name
                  </label>
                  <input
                    type="text"
                    name="employer_name"
                    value={formData.employer_name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Company/organization name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Employer NTN
                  </label>
                  <input
                    type="text"
                    name="employer_ntn"
                    value={formData.employer_ntn}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Employer's NTN"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Employer Address
                  </label>
                  <textarea
                    name="employer_address"
                    value={formData.employer_address}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    rows="2"
                    placeholder="Employer's complete address"
                  />
                </div>
              </div>
            </div>

            {/* FBR Information Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b pb-2">
                FBR Registration Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    FBR Registration Number
                  </label>
                  <input
                    type="text"
                    name="fbr_registration_number"
                    value={formData.fbr_registration_number}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="FBR registration number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax Circle
                  </label>
                  <input
                    type="text"
                    name="tax_circle"
                    value={formData.tax_circle}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Tax circle"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zone
                  </label>
                  <input
                    type="text"
                    name="zone"
                    value={formData.zone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Zone"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-4 pt-6 border-t">
              <button
                type="button"
                onClick={() => navigate('/logout')}
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Logout
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save and Continue'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PersonalInfoForm;
