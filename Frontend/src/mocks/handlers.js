import { rest } from 'msw';

export const handlers = [
  // Mock tax years
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

  // Mock employers
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
  }),

  // Mock form completion status
  rest.get('/api/forms/completion-status/:taxYearId', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          income: 'completed',
          'adjustable-tax': 'pending',
          reductions: 'pending',
          credits: 'pending',
          deductions: 'pending',
          'final-tax': 'pending',
          'capital-gains': 'pending',
          expenses: 'pending',
          wealth: 'pending'
        }
      })
    );
  }),

  // Mock form save
  rest.post('/api/forms/:formType', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          ...req.body,
          is_complete: true
        },
        message: 'Form saved successfully'
      })
    );
  }),

  // Mock form update
  rest.put('/api/forms/:formType/:id', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          ...req.body,
          is_complete: true
        },
        message: 'Form updated successfully'
      })
    );
  }),

  // Mock form get
  rest.get('/api/forms/:formType/:id', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          monthly_salary: 50000,
          bonus: 10000,
          is_complete: true
        }
      })
    );
  }),

  // Mock form completion status update
  rest.put('/api/forms/completion-status/:taxYearId', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          ...req.body,
          status: 'completed'
        }
      })
    );
  })
]; 