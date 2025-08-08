import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  FileCheck,
  History,
  Info,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

const ExcelManager = () => {
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState('');
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('export');

  useEffect(() => {
    loadAvailableYears();
    loadHistory();
  }, []);

  const loadAvailableYears = async () => {
    try {
      const response = await axios.get('/api/reports/available-years');
      if (response.data.success) {
        setAvailableYears(response.data.data);
        if (response.data.data.length > 0) {
          setSelectedYear(response.data.data[0].tax_year);
        }
      }
    } catch (error) {
      console.error('Error loading available years:', error);
      toast.error('Failed to load available tax years');
    }
  };

  const loadHistory = async () => {
    try {
      const response = await axios.get('/api/excel/history');
      if (response.data.success) {
        setHistory(response.data.data);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const handleExport = async () => {
    if (!selectedYear) {
      toast.error('Please select a tax year');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`/api/excel/export/${selectedYear}`, {
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Tax_Return_${selectedYear}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Excel file exported successfully');
      loadHistory(); // Refresh history

    } catch (error) {
      console.error('Export error:', error);
      if (error.response?.status === 404) {
        toast.error('No tax data found for selected year');
      } else {
        toast.error('Failed to export Excel file');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        toast.error('Please select a valid Excel (.xlsx) file');
        return;
      }
      setSelectedFile(file);
      setValidationResult(null);
    }
  };

  const handleValidate = async () => {
    if (!selectedFile || !selectedYear) {
      toast.error('Please select a file and tax year');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('excelFile', selectedFile);

      const response = await axios.post(`/api/excel/validate/${selectedYear}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setValidationResult(response.data.data);
        toast.success('File validation completed');
      }

    } catch (error) {
      console.error('Validation error:', error);
      toast.error('File validation failed');
      setValidationResult({
        valid: false,
        errors: [error.response?.data?.message || 'Validation failed']
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !selectedYear) {
      toast.error('Please select a file and tax year');
      return;
    }

    if (validationResult && !validationResult.valid) {
      toast.error('Please fix validation errors before importing');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('excelFile', selectedFile);

      const response = await axios.post(`/api/excel/import/${selectedYear}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        toast.success('Excel file imported successfully');
        setSelectedFile(null);
        setValidationResult(null);
        loadHistory(); // Refresh history
        
        // Reset file input
        const fileInput = document.getElementById('excel-file-input');
        if (fileInput) fileInput.value = '';
      }

    } catch (error) {
      console.error('Import error:', error);
      toast.error(error.response?.data?.message || 'Failed to import Excel file');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const ValidationResults = ({ validation }) => {
    if (!validation) return null;

    return (
      <div className="mt-4 p-4 border rounded-lg">
        <div className="flex items-center space-x-2 mb-3">
          {validation.valid ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500" />
          )}
          <h4 className="font-medium">
            {validation.valid ? 'Validation Passed' : 'Validation Issues Found'}
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-blue-50 rounded">
            <div className="text-2xl font-bold text-blue-600">{validation.summary.totalSheets}</div>
            <div className="text-sm text-gray-600">Total Sheets</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded">
            <div className="text-2xl font-bold text-green-600">{validation.summary.validSheets}</div>
            <div className="text-sm text-gray-600">Valid Sheets</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded">
            <div className="text-2xl font-bold text-red-600">{validation.summary.missingSheets}</div>
            <div className="text-sm text-gray-600">Missing Sheets</div>
          </div>
        </div>

        {validation.warnings.length > 0 && (
          <div className="mb-4">
            <h5 className="font-medium text-yellow-800 mb-2">Warnings:</h5>
            <ul className="list-disc list-inside space-y-1">
              {validation.warnings.map((warning, index) => (
                <li key={index} className="text-yellow-700 text-sm">{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {validation.errors.length > 0 && (
          <div className="mb-4">
            <h5 className="font-medium text-red-800 mb-2">Errors:</h5>
            <ul className="list-disc list-inside space-y-1">
              {validation.errors.map((error, index) => (
                <li key={index} className="text-red-700 text-sm">{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4">
          <h5 className="font-medium text-gray-800 mb-2">Sheet Details:</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {validation.sheets.map((sheet, index) => (
              <div key={index} className={`flex items-center justify-between p-2 rounded text-sm ${
                sheet.exists ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                <span>{sheet.name}</span>
                <div className="flex items-center space-x-2">
                  {sheet.exists ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-xs">({sheet.rowCount} rows)</span>
                    </>
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Excel Import/Export</h1>
            <p className="text-gray-600">
              Export your tax data to Excel for analysis or import updated data from Excel
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-4">
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="form-select border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {availableYears.map(year => (
                <option key={year.tax_year} value={year.tax_year}>
                  {year.tax_year}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <History className="w-4 h-4" />
              <span>History</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'export', label: 'Export to Excel', icon: Download },
              { id: 'import', label: 'Import from Excel', icon: Upload }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'export' && (
            <div className="space-y-6">
              {/* Export Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 mb-2">Export Tax Data to Excel</h3>
                    <p className="text-blue-800 mb-4">
                      Download all your tax form data as a comprehensive Excel workbook with modern formatting.
                      The workbook includes separate sheets for each tax form with all your data.
                    </p>
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={handleExport}
                        disabled={loading || !selectedYear}
                        className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                      >
                        {loading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        <span>{loading ? 'Exporting...' : 'Export to Excel'}</span>
                      </button>
                      <div className="text-sm text-blue-700">
                        <Info className="w-4 h-4 inline mr-1" />
                        Excel file will include user details and all tax forms
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Export Features */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Modern Styling</h4>
                  <p className="text-green-700 text-sm">
                    Professional formatting with colors, borders, and proper alignment
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-medium text-purple-900 mb-2">Complete Data</h4>
                  <p className="text-purple-700 text-sm">
                    All forms including Income, Deductions, Credits, and Wealth Statement
                  </p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-medium text-orange-900 mb-2">Ready to Edit</h4>
                  <p className="text-orange-700 text-sm">
                    Structured format that you can modify and import back
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-6">
              {/* Import Section */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <Upload className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-900 mb-2">Import Tax Data from Excel</h3>
                    <p className="text-green-800 mb-4">
                      Upload an Excel file with your tax data to update the system. The file should follow
                      the same structure as the exported Excel workbook.
                    </p>
                    
                    <div className="space-y-4">
                      {/* File Upload */}
                      <div>
                        <label htmlFor="excel-file-input" className="block text-sm font-medium text-gray-700 mb-2">
                          Select Excel File (.xlsx)
                        </label>
                        <input
                          type="file"
                          id="excel-file-input"
                          accept=".xlsx"
                          onChange={handleFileSelect}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                        />
                      </div>

                      {/* Selected File Info */}
                      {selectedFile && (
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <div className="flex items-center space-x-3">
                            <FileCheck className="w-5 h-5 text-green-500" />
                            <div>
                              <p className="font-medium">{selectedFile.name}</p>
                              <p className="text-sm text-gray-600">
                                Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={handleValidate}
                          disabled={loading || !selectedFile}
                          className="flex items-center space-x-2 bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700 transition-colors disabled:bg-gray-400"
                        >
                          {loading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <FileCheck className="w-4 h-4" />
                          )}
                          <span>{loading ? 'Validating...' : 'Validate File'}</span>
                        </button>

                        <button
                          onClick={handleImport}
                          disabled={loading || !selectedFile || (validationResult && !validationResult.valid)}
                          className="flex items-center space-x-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
                        >
                          {loading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          <span>{loading ? 'Importing...' : 'Import Data'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation Results */}
              <ValidationResults validation={validationResult} />

              {/* Import Guidelines */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h4 className="font-medium text-yellow-900 mb-3">Import Guidelines</h4>
                <ul className="list-disc list-inside space-y-1 text-yellow-800 text-sm">
                  <li>Use only Excel files (.xlsx) exported from this system</li>
                  <li>Do not modify the structure or sheet names</li>
                  <li>Only edit the values in the "Value (PKR)" column</li>
                  <li>Validate the file before importing to check for issues</li>
                  <li>Make sure all required sheets are present in the file</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-96 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Import/Export History</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto max-h-80">
              {history.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No import/export history found</p>
              ) : (
                <div className="space-y-3">
                  {history.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {item.action === 'EXCEL_EXPORT' ? (
                          <Download className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Upload className="w-4 h-4 text-green-500" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{item.description}</p>
                          <p className="text-xs text-gray-600">{formatDate(item.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExcelManager;