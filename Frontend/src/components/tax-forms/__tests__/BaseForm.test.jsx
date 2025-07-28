import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { NotificationProvider } from '../../../context/NotificationContext';
import { TaxFormProvider } from '../../../context/TaxFormContext';
import BaseForm from '../BaseForm';
import theme from '../../../styles/theme';
import * as Yup from 'yup';
import { rest } from 'msw';
import { server } from '../../../mocks/server';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() }
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn()
  }))
}));

const mockInitialValues = {
  monthly_salary: '',
  bonus: '',
};

const mockValidationSchema = Yup.object({
  monthly_salary: Yup.number().required('Monthly Salary is required'),
  bonus: Yup.number().required('Bonus is required'),
});

const mockFormFields = [
  { name: 'monthly_salary', label: 'Monthly Salary', type: 'number' },
  { name: 'bonus', label: 'Bonus', type: 'number' },
];

const renderWithProviders = (component) => {
  return render(
    <ThemeProvider theme={theme}>
      <NotificationProvider>
        <TaxFormProvider>
          {component}
        </TaxFormProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
};

describe('BaseForm', () => {
  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    jest.clearAllMocks();
  });
  afterAll(() => server.close());

  beforeEach(() => {
    // Mock successful API responses
    server.use(
      rest.get('/api/tax-years', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: [
              { id: '1', tax_year: '2024-25' },
              { id: '2', tax_year: '2023-24' }
            ]
          })
        );
      }),
      rest.get('/api/employers', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: [
              { id: '1', name: 'Company A' },
              { id: '2', name: 'Company B' }
            ]
          })
        );
      })
    );
  });

  it('renders form fields correctly', async () => {
    await act(async () => {
      renderWithProviders(
        <BaseForm
          initialValues={mockInitialValues}
          validationSchema={mockValidationSchema}
          formFields={mockFormFields}
          title="Test Form"
          formType="income"
        />
      );
    });

    // Wait for loading state to finish
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Test Form')).toBeInTheDocument();
    expect(screen.getByLabelText('Monthly Salary')).toBeInTheDocument();
    expect(screen.getByLabelText('Bonus')).toBeInTheDocument();
  });

  it('shows validation errors when submitting empty form', async () => {
    await act(async () => {
      renderWithProviders(
        <BaseForm
          initialValues={mockInitialValues}
          validationSchema={mockValidationSchema}
          formFields={mockFormFields}
          title="Test Form"
          formType="income"
        />
      );
    });

    // Wait for loading state to finish
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /save/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Monthly Salary is required')).toBeInTheDocument();
      expect(screen.getByText('Bonus is required')).toBeInTheDocument();
    });
  });

  it('calls onSubmit with form data when form is valid', async () => {
    const mockOnSubmit = jest.fn();
    await act(async () => {
      renderWithProviders(
        <BaseForm
          initialValues={mockInitialValues}
          validationSchema={mockValidationSchema}
          formFields={mockFormFields}
          title="Test Form"
          formType="income"
          onSubmit={mockOnSubmit}
        />
      );
    });

    // Wait for loading state to finish
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    const salaryInput = screen.getByLabelText('Monthly Salary');
    const bonusInput = screen.getByLabelText('Bonus');
    const submitButton = screen.getByRole('button', { name: /save/i });

    await act(async () => {
      fireEvent.change(salaryInput, { target: { value: '50000' } });
      fireEvent.change(bonusInput, { target: { value: '10000' } });
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        monthly_salary: 50000,
        bonus: 10000,
      });
    });
  });

  it('shows loading state when loading prop is true', () => {
    renderWithProviders(
      <BaseForm
        initialValues={mockInitialValues}
        validationSchema={mockValidationSchema}
        formFields={mockFormFields}
        title="Test Form"
        formType="income"
        loading={true}
      />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows error message when error prop is provided', async () => {
    const errorMessage = 'Something went wrong';
    await act(async () => {
      renderWithProviders(
        <BaseForm
          initialValues={mockInitialValues}
          validationSchema={mockValidationSchema}
          formFields={mockFormFields}
          title="Test Form"
          formType="income"
          error={errorMessage}
        />
      );
    });

    // Wait for loading state to finish
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('disables submit button while submitting', async () => {
    server.use(
      rest.post('/api/forms/income', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: {
              monthly_salary: '50000',
              bonus: '10000',
              is_complete: true
            }
          })
        );
      })
    );

    const mockOnSubmit = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
    await act(async () => {
      renderWithProviders(
        <BaseForm
          initialValues={mockInitialValues}
          validationSchema={mockValidationSchema}
          formFields={mockFormFields}
          title="Test Form"
          formType="income"
          onSubmit={mockOnSubmit}
        />
      );
    });

    // Wait for loading state to finish
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    const salaryInput = screen.getByLabelText('Monthly Salary');
    const bonusInput = screen.getByLabelText('Bonus');
    const submitButton = screen.getByRole('button', { name: /save/i });

    await act(async () => {
      fireEvent.change(salaryInput, { target: { value: '50000' } });
      fireEvent.change(bonusInput, { target: { value: '10000' } });
      fireEvent.click(submitButton);
    });

    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent('Saving...');

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
      expect(submitButton).toHaveTextContent('Save');
    });
  });
}); 