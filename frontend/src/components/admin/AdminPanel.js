import React, { useState } from "react";
import { Shield, Calculator, Users } from "lucide-react";
import { currency, sumFields, TaxEngine } from "../../utils/taxUtils";

const AdminPanel = ({ users, setUsers, onBackToCalculator }) => {
  const [selectedUser, setSelectedUser] = useState(null);

  const deleteUser = (userId) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      setUsers(users.filter(u => u.id !== userId));
      setSelectedUser(null);
    }
  };

  const calculateUserTax = (userData) => {
    const incFields = ["monthlySalary", "bonus", "carAllowance", "otherTaxable"];
    const totalIncome = sumFields(userData.income, incFields);
    const taxableIncome = totalIncome - (+userData.deductions.zakat || 0);
    const normalTax = TaxEngine.calcNormalTax(taxableIncome);
    return { totalIncome, taxableIncome, normalTax };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-600" />
              Admin Dashboard
            </h1>
            <p className="text-sm text-gray-600 mt-1">Manage users and view tax calculations</p>
          </div>
          <button
            onClick={onBackToCalculator}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Calculator className="w-4 h-4" />
            Back to Calculator
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  All Users ({users.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Income</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tax Liability</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map(user => {
                      const { totalIncome, normalTax } = calculateUserTax(user.taxData);
                      return (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <div className="font-medium text-gray-900">{user.name}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{currency(totalIncome)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{currency(normalTax)}</td>
                          <td className="px-4 py-3">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => setSelectedUser(user)}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              >
                                View Details
                              </button>
                              {user.role !== 'admin' && (
                                <button
                                  onClick={() => deleteUser(user.id)}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div>
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">User Details</h2>
              </div>
              <div className="p-4">
                {selectedUser ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium text-gray-900">{selectedUser.name}</h3>
                      <p className="text-sm text-gray-500">{selectedUser.email}</p>
                      <p className="text-xs text-gray-400">Joined: {new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                    </div>
                    
                    <div className="border-t pt-4">
                      <h4 className="font-medium text-gray-900 mb-2">Tax Summary</h4>
                      {(() => {
                        const { totalIncome, taxableIncome, normalTax } = calculateUserTax(selectedUser.taxData);
                        return (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Total Income:</span>
                              <span className="font-mono">{currency(totalIncome)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Taxable Income:</span>
                              <span className="font-mono">{currency(taxableIncome)}</span>
                            </div>
                            <div className="flex justify-between border-t pt-2">
                              <span>Tax Liability:</span>
                              <span className="font-mono font-semibold">{currency(normalTax)}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">Select a user to view details</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow mt-6">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">System Statistics</h2>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between">
                  <span>Total Users:</span>
                  <span className="font-semibold">{users.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Admin Users:</span>
                  <span className="font-semibold">{users.filter(u => u.role === 'admin').length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Regular Users:</span>
                  <span className="font-semibold">{users.filter(u => u.role === 'user').length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel; 