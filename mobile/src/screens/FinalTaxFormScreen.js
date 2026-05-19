import React from 'react';
import ComingSoonScreen from './ComingSoonScreen';

const FinalTaxFormScreen = (props) => (
  <ComingSoonScreen
    {...props}
    route={{
      params: {
        title: 'Final Tax Calculation',
        icon: 'calculate',
        description: 'Final tax review and submission are not yet available on mobile.',
      },
    }}
  />
);

export default FinalTaxFormScreen;
