import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { rest } from 'msw';
import { TaxFormProvider, useTaxForm } from '../TaxFormContext';
import { NotificationProvider } from '../NotificationContext';
import { server } from '../../mocks/server';

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

// Mock component to test the context
const TestComponent = () => {
  const { loading, error, taxYears, loadTaxYears } = useTaxForm();

  React.useEffect(() => {
    loadTaxYears();
  }, [loadTaxYears]);

  if (loading) return <div data-testid="loading">Loading...</div>;
  if (error) return <div data-testid="error">Error: {error}</div>;

  return (
    <div>
      {taxYears.map((year) => (
        <div key={year.id}>{year.tax_year}</div>
      ))}
    </div>
  );
};

describe('TaxFormContext', () => {
  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    jest.clearAllMocks();
  });
  afterAll(() => server.close());

  it('provides loading state', async () => {
    server.use(
      rest.get('/api/tax-years', (req, res, ctx) => {
        return res(ctx.delay(100), ctx.json({ data: [] }));
      })
    );

    let rendered;
    await act(async () => {
      rendered = render(
        <NotificationProvider>
          <TaxFormProvider>
            <TestComponent />
          </TaxFormProvider>
        </NotificationProvider>
      );
    });

    // Wait for loading state to appear
    await waitFor(() => {
      expect(rendered.getByTestId('loading')).toBeInTheDocument();
    });
  });

  it('loads tax years successfully', async () => {
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
      })
    );

    let rendered;
    await act(async () => {
      rendered = render(
        <NotificationProvider>
          <TaxFormProvider>
            <TestComponent />
          </TaxFormProvider>
        </NotificationProvider>
      );
    });

    // Wait for loading state to disappear
    await waitFor(() => {
      expect(rendered.queryByTestId('loading')).not.toBeInTheDocument();
    });

    // Check tax years are displayed
    await waitFor(() => {
      expect(rendered.getByText('2024-25')).toBeInTheDocument();
      expect(rendered.getByText('2023-24')).toBeInTheDocument();
    });
  });

  it('handles API errors', async () => {
    server.use(
      rest.get('/api/tax-years', (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({ error: 'Failed to load tax years' })
        );
      })
    );

    let rendered;
    await act(async () => {
      rendered = render(
        <NotificationProvider>
          <TaxFormProvider>
            <TestComponent />
          </TaxFormProvider>
        </NotificationProvider>
      );
    });

    await waitFor(() => {
      expect(rendered.getByTestId('error')).toBeInTheDocument();
    });
  });

  it('saves form data successfully', async () => {
    const mockFormData = {
      monthly_salary: 50000,
      bonus: 10000
    };

    server.use(
      rest.post('/api/forms/income', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: {
              ...mockFormData,
              is_complete: true
            },
            message: 'Form saved successfully'
          })
        );
      })
    );

    const TestSaveComponent = () => {
      const { saveForm } = useTaxForm();
      const [message, setMessage] = React.useState('');

      const handleSave = async () => {
        try {
          await saveForm('income', mockFormData);
          setMessage('Form saved successfully');
        } catch (error) {
          // Error will be handled by context
        }
      };

      return (
        <div>
          <button onClick={handleSave}>Save</button>
          {message && <div data-testid="success-message">{message}</div>}
        </div>
      );
    };

    let rendered;
    await act(async () => {
      rendered = render(
        <NotificationProvider>
          <TaxFormProvider>
            <TestSaveComponent />
          </TaxFormProvider>
        </NotificationProvider>
      );
    });

    const saveButton = rendered.getByText('Save');
    await act(async () => {
      saveButton.click();
    });

    // Wait for success message to appear
    await waitFor(() => {
      expect(rendered.getByTestId('success-message')).toBeInTheDocument();
    });
  });

  it('handles form save errors', async () => {
    server.use(
      rest.post('/api/forms/income', (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({ error: 'Failed to save form' })
        );
      })
    );

    const TestSaveComponent = () => {
      const { saveForm } = useTaxForm();
      const [error, setError] = React.useState('');

      const handleSave = async () => {
        try {
          await saveForm('income', {
            monthly_salary: 50000,
            bonus: 10000
          });
        } catch (error) {
          setError('Failed to save form');
        }
      };

      return (
        <div>
          <button onClick={handleSave}>Save</button>
          {error && <div data-testid="error-message">{error}</div>}
        </div>
      );
    };

    let rendered;
    await act(async () => {
      rendered = render(
        <NotificationProvider>
          <TaxFormProvider>
            <TestSaveComponent />
          </TaxFormProvider>
        </NotificationProvider>
      );
    });

    const saveButton = rendered.getByText('Save');
    await act(async () => {
      saveButton.click();
    });

    await waitFor(() => {
      expect(rendered.getByTestId('error-message')).toBeInTheDocument();
    });
  });

  it('loads form data successfully', async () => {
    const mockFormData = {
      monthly_salary: 50000,
      bonus: 10000,
      is_complete: true
    };

    server.use(
      rest.get('/api/forms/income/test-id', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            data: mockFormData
          })
        );
      })
    );

    const TestLoadComponent = () => {
      const { loadForm } = useTaxForm();
      const [formData, setFormData] = React.useState(null);

      React.useEffect(() => {
        const loadData = async () => {
          try {
            const data = await loadForm('income', 'test-id');
            setFormData(data);
          } catch (error) {
            // Error will be handled by context
          }
        };
        loadData();
      }, [loadForm]);

      if (!formData) return <div data-testid="loading">Loading form...</div>;
      return <div data-testid="salary">Salary: {formData.monthly_salary}</div>;
    };

    let rendered;
    await act(async () => {
      rendered = render(
        <NotificationProvider>
          <TaxFormProvider>
            <TestLoadComponent />
          </TaxFormProvider>
        </NotificationProvider>
      );
    });

    // Wait for loading state to disappear and salary to appear
    await waitFor(() => {
      expect(rendered.queryByTestId('loading')).not.toBeInTheDocument();
      expect(rendered.getByTestId('salary')).toHaveTextContent('Salary: 50000');
    });
  });

  it('handles form load errors', async () => {
    server.use(
      rest.get('/api/forms/income/test-id', (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({ error: 'Failed to load form' })
        );
      })
    );

    const TestLoadComponent = () => {
      const { loadForm } = useTaxForm();
      const [error, setError] = React.useState(null);

      React.useEffect(() => {
        const loadData = async () => {
          try {
            await loadForm('income', 'test-id');
          } catch (err) {
            setError('Failed to load form');
          }
        };
        loadData();
      }, [loadForm]);

      if (error) return <div data-testid="error-message">{error}</div>;
      return <div data-testid="loading">Loading form...</div>;
    };

    let rendered;
    await act(async () => {
      rendered = render(
        <NotificationProvider>
          <TaxFormProvider>
            <TestLoadComponent />
          </TaxFormProvider>
        </NotificationProvider>
      );
    });

    await waitFor(() => {
      expect(rendered.getByTestId('error-message')).toBeInTheDocument();
    });
  });
}); 