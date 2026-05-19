import React from 'react';
import ComingSoonScreen from './ComingSoonScreen';

const DeductionsFormScreen = (props) => (
  <ComingSoonScreen
    {...props}
    route={{
      params: {
        title: 'Deductions & Allowances',
        icon: 'receipt',
        description: 'Zakat, donations, and advance-tax deductions are not yet available on mobile.',
      },
    }}
  />
);

export default DeductionsFormScreen;
