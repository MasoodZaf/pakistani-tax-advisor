import React, { useState } from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import IncomeForm from './IncomeForm';
import AdjustableTaxForm from './AdjustableTaxForm';
import ReductionsForm from './ReductionsForm';
import CreditsForm from './CreditsForm';
import DeductionsForm from './DeductionsForm';
import FinalTaxForm from './FinalTaxForm';
import CapitalGainForm from './CapitalGainForm';
import ExpensesForm from './ExpensesForm';
import WealthForm from './WealthForm';

const TabPanel = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const TaxFormsContainer = () => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <div className="bg-white rounded-xl shadow-card">
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': {
            textTransform: 'none',
            fontSize: '1rem',
            fontWeight: 500,
          },
          '& .Mui-selected': {
            color: '#00A651 !important',
          },
          '& .MuiTabs-indicator': {
            backgroundColor: '#00A651',
          },
        }}
      >
        <Tab label="Income" />
        <Tab label="Adjustable Tax" />
        <Tab label="Reductions" />
        <Tab label="Credits" />
        <Tab label="Deductions" />
        <Tab label="Final Tax" />
        <Tab label="Capital Gains" />
        <Tab label="Expenses" />
        <Tab label="Wealth Statement" />
      </Tabs>

      <TabPanel value={activeTab} index={0}>
        <IncomeForm />
      </TabPanel>
      <TabPanel value={activeTab} index={1}>
        <AdjustableTaxForm />
      </TabPanel>
      <TabPanel value={activeTab} index={2}>
        <ReductionsForm />
      </TabPanel>
      <TabPanel value={activeTab} index={3}>
        <CreditsForm />
      </TabPanel>
      <TabPanel value={activeTab} index={4}>
        <DeductionsForm />
      </TabPanel>
      <TabPanel value={activeTab} index={5}>
        <FinalTaxForm />
      </TabPanel>
      <TabPanel value={activeTab} index={6}>
        <CapitalGainForm />
      </TabPanel>
      <TabPanel value={activeTab} index={7}>
        <ExpensesForm />
      </TabPanel>
      <TabPanel value={activeTab} index={8}>
        <WealthForm />
      </TabPanel>
    </div>
  );
};

export default TaxFormsContainer; 