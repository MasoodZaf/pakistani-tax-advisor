import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const sampleData = [
  { name: 'Salary', amount: 2500000, tax: 125000 },
  { name: 'Bonus', amount: 500000, tax: 25000 },
  { name: 'Allowances', amount: 300000, tax: 15000 },
  { name: 'Other', amount: 200000, tax: 10000 },
];

const TaxSummaryChart = () => {
  return (
    <div className="card w-full h-[400px]">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Tax Summary</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sampleData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="amount" fill="#00A651" name="Income" />
          <Bar dataKey="tax" fill="#4B5563" name="Tax" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TaxSummaryChart; 