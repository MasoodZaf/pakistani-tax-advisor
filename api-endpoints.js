{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx566\tx1133\tx1700\tx2267\tx2834\tx3401\tx3968\tx4535\tx5102\tx5669\tx6236\tx6803\pardirnatural\partightenfactor0

\f0\fs24 \cf0 // Pakistani Tax Advisor - API Data Flow Examples\
// How data flows between frontend, backend, and individual form tables\
\
// =============================================\
// BACKEND API ENDPOINTS\
// =============================================\
\
// 1. USER LOGIN - Pull all tax data from form tables (multi-year support)\
app.post('/api/login', async (req, res) => \{\
  try \{\
    const \{ email, password \} = req.body;\
    \
    // Authenticate user\
    const user = await db.query(`\
      SELECT id, email, name, password_hash, role, user_type \
      FROM users \
      WHERE email = $1 AND is_active = true\
    `, [email]);\
    \
    if (!user.rows[0] || !bcrypt.compareSync(password, user.rows[0].password_hash)) \{\
      return res.status(401).json(\{ error: 'Invalid credentials' \});\
    \}\
    \
    const userData = user.rows[0];\
    \
    // Get user's tax years summary (shows all years)\
    const taxYearsSummary = await db.query(`\
      SELECT * FROM get_user_tax_years_summary($1)\
    `, [userData.id]);\
    \
    // Get current year tax data by default\
    const currentYearData = await db.query(`\
      SELECT * FROM get_user_tax_forms($1, NULL)\
    `, [userData.id]);\
    \
    // Create session\
    const sessionToken = generateSessionToken();\
    await db.query(`\
      INSERT INTO user_sessions (user_id, user_email, session_token, ip_address, expires_at)\
      VALUES ($1, $2, $3, $4, $5)\
    `, [userData.id, userData.email, sessionToken, req.ip, new Date(Date.now() + 24*60*60*1000)]);\
    \
    // Log audit trail\
    await db.query(`\
      INSERT INTO audit_log (user_id, user_email, action, table_name, ip_address, user_agent)\
      VALUES ($1, $2, 'login', 'users', $3, $4)\
    `, [userData.id, userData.email, req.ip, req.headers['user-agent']]);\
    \
    res.json(\{\
      success: true,\
      user: \{\
        id: userData.id,\
        email: userData.email,\
        name: userData.name,\
        role: userData.role\
      \},\
      taxYearsSummary: taxYearsSummary.rows, // All years summary\
      currentYearData: currentYearData.rows, // All current year forms\
      sessionToken\
    \});\
    \
  \} catch (error) \{\
    console.error('Login error:', error);\
    res.status(500).json(\{ error: 'Login failed' \});\
  \}\
\});\
\
// 2. NEW USER REGISTRATION - Initialize forms for current tax year\
app.post('/api/register', async (req, res) => \{\
  const client = await db.getClient();\
  \
  try \{\
    await client.query('BEGIN');\
    \
    const \{ email, name, password \} = req.body;\
    const passwordHash = bcrypt.hashSync(password, 10);\
    \
    // Create user\
    const userResult = await client.query(`\
      INSERT INTO users (email, name, password_hash, user_type, role)\
      VALUES ($1, $2, $3, 'individual', 'user')\
      RETURNING id, email, name\
    `, [email, name, passwordHash]);\
    \
    const newUser = userResult.rows[0];\
    \
    // Get current tax year\
    const taxYearResult = await client.query(`\
      SELECT id, tax_year FROM tax_years WHERE is_current = true\
    `);\
    \
    if (taxYearResult.rows.length === 0) \{\
      throw new Error('No current tax year found');\
    \}\
    \
    const currentTaxYear = taxYearResult.rows[0];\
    \
    // Create tax return for current year\
    const returnResult = await client.query(`\
      INSERT INTO tax_returns (user_id, user_email, tax_year_id, return_type, filing_status)\
      VALUES ($1, $2, $3, 'individual', 'draft')\
      RETURNING id\
    `, [newUser.id, newUser.email, currentTaxYear.id]);\
    \
    const taxReturnId = returnResult.rows[0].id;\
    \
    // Initialize all form tables for current year\
    await client.query(`\
      SELECT initialize_tax_forms($1, $2, $3, $4, $5)\
    `, [taxReturnId, newUser.id, newUser.email, currentTaxYear.id, currentTaxYear.tax_year]);\
    \
    await client.query('COMMIT');\
    \
    res.json(\{\
      success: true,\
      message: 'User registered successfully',\
      user: newUser,\
      currentTaxYear: currentTaxYear.tax_year\
    \});\
    \
  \} catch (error) \{\
    await client.query('ROLLBACK');\
    console.error('Registration error:', error);\
    res.status(500).json(\{ error: 'Registration failed' \});\
  \} finally \{\
    client.release();\
  \}\
\});\
\
// 3. CREATE NEW TAX YEAR RETURN - Initialize forms for specific year\
app.post('/api/tax-returns/create/:taxYear', async (req, res) => \{\
  const client = await db.getClient();\
  \
  try \{\
    await client.query('BEGIN');\
    \
    const \{ taxYear \} = req.params;\
    const \{ userId, userEmail \} = req.body;\
    \
    // Get tax year information\
    const taxYearResult = await client.query(`\
      SELECT id, tax_year FROM tax_years WHERE tax_year = $1 AND is_active = true\
    `, [taxYear]);\
    \
    if (taxYearResult.rows.length === 0) \{\
      return res.status(404).json(\{ error: 'Tax year not found' \});\
    \}\
    \
    const taxYearData = taxYearResult.rows[0];\
    \
    // Check if user already has a return for this year\
    const existingReturn = await client.query(`\
      SELECT id FROM tax_returns \
      WHERE user_id = $1 AND tax_year_id = $2\
    `, [userId, taxYearData.id]);\
    \
    if (existingReturn.rows.length > 0) \{\
      return res.status(400).json(\{ error: 'Tax return already exists for this year' \});\
    \}\
    \
    // Create new tax return\
    const returnResult = await client.query(`\
      INSERT INTO tax_returns (user_id, user_email, tax_year_id, return_type, filing_status)\
      VALUES ($1, $2, $3, 'individual', 'draft')\
      RETURNING id\
    `, [userId, userEmail, taxYearData.id]);\
    \
    const taxReturnId = returnResult.rows[0].id;\
    \
    // Initialize all form tables for this year\
    const initResult = await client.query(`\
      SELECT initialize_tax_forms($1, $2, $3, $4, $5)\
    `, [taxReturnId, userId, userEmail, taxYearData.id, taxYearData.tax_year]);\
    \
    if (!initResult.rows[0].initialize_tax_forms) \{\
      throw new Error('Failed to initialize tax forms');\
    \}\
    \
    await client.query('COMMIT');\
    \
    res.json(\{\
      success: true,\
      message: `Tax return created for $\{taxYear\}`,\
      taxReturnId,\
      taxYear: taxYearData.tax_year\
    \});\
    \
  \} catch (error) \{\
    await client.query('ROLLBACK');\
    console.error('Create tax return error:', error);\
    res.status(500).json(\{ error: 'Failed to create tax return' \});\
  \} finally \{\
    client.release();\
  \}\
\});\
\
// 4. GET SPECIFIC TAX YEAR DATA - Pull from form tables for specific year\
app.get('/api/tax-forms/:userId/:taxYear', async (req, res) => \{\
  try \{\
    const \{ userId, taxYear \} = req.params;\
    const userEmail = req.user.email; // From auth middleware\
    \
    // Validate user access\
    const userValidation = await db.query(`\
      SELECT id FROM users WHERE id = $1 AND email = $2 AND is_active = true\
    `, [userId, userEmail]);\
    \
    if (userValidation.rows.length === 0) \{\
      return res.status(403).json(\{ error: 'Unauthorized access' \});\
    \}\
    \
    // Get complete tax forms data for specific year\
    const formsData = await db.query(`\
      SELECT * FROM get_user_tax_forms($1, $2)\
    `, [userId, taxYear]);\
    \
    if (formsData.rows.length === 0) \{\
      return res.status(404).json(\{ \
        error: 'No tax data found for this year',\
        message: `No tax return exists for $\{taxYear\}. Create one first.`\
      \});\
    \}\
    \
    const data = formsData.rows[0];\
    \
    // Transform data for frontend consumption\
    const responseData = \{\
      taxReturnId: data.tax_return_id,\
      taxYearId: data.tax_year_id,\
      taxYear: data.tax_year,\
      filingStatus: data.filing_status,\
      forms: \{\
        income: data.income_data,\
        adjustableTax: data.adjustable_tax_data,\
        reductions: data.reductions_data,\
        credits: data.credits_data,\
        deductions: data.deductions_data,\
        finalTax: data.final_tax_data,\
        capitalGain: data.capital_gain_data,\
        expenses: data.expenses_data,\
        wealth: data.wealth_data\
      \},\
      completionStatus: data.completion_status,\
      calculationSummary: data.calculation_summary\
    \};\
    \
    res.json(\{\
      success: true,\
      data: responseData\
    \});\
    \
  \} catch (error) \{\
    console.error('Get forms error:', error);\
    res.status(500).json(\{ error: 'Failed to retrieve tax forms' \});\
  \}\
\});\
\
// 5. GET ALL TAX YEARS SUMMARY - Show user's tax returns across all years\
app.get('/api/tax-years-summary/:userId', async (req, res) => \{\
  try \{\
    const \{ userId \} = req.params;\
    const userEmail = req.user.email;\
    \
    // Validate user access\
    const userValidation = await db.query(`\
      SELECT id FROM users WHERE id = $1 AND email = $2 AND is_active = true\
    `, [userId, userEmail]);\
    \
    if (userValidation.rows.length === 0) \{\
      return res.status(403).json(\{ error: 'Unauthorized access' \});\
    \}\
    \
    // Get tax years summary\
    const summary = await db.query(`\
      SELECT * FROM get_user_tax_years_summary($1)\
    `, [userId]);\
    \
    res.json(\{\
      success: true,\
      data: summary.rows,\
      message: `Found $\{summary.rows.length\} tax years`\
    \});\
    \
  \} catch (error) \{\
    console.error('Get tax years summary error:', error);\
    res.status(500).json(\{ error: 'Failed to retrieve tax years summary' \});\
  \}\
\});\
\
// 6. UPDATE INCOME FORM - Push data to income_forms table (year-specific)\
app.put('/api/tax-forms/income/:taxYear', async (req, res) => \{\
  try \{\
    const \{ taxYear \} = req.params;\
    const \{ userId, userEmail, formData \} = req.body;\
    \
    // Get tax return for specific year\
    const taxReturnQuery = await db.query(`\
      SELECT tr.id as tax_return_id, ty.id as tax_year_id\
      FROM tax_returns tr\
      JOIN tax_years ty ON tr.tax_year_id = ty.id\
      JOIN users u ON tr.user_id = u.id\
      WHERE tr.user_id = $1 AND tr.user_email = $2 AND ty.tax_year = $3 \
      AND u.email = $2 AND u.is_active = true\
    `, [userId, userEmail, taxYear]);\
    \
    if (taxReturnQuery.rows.length === 0) \{\
      return res.status(404).json(\{ \
        error: 'Tax return not found',\
        message: `No tax return found for $\{taxYear\}. Create one first.`\
      \});\
    \}\
    \
    const \{ tax_return_id: taxReturnId, tax_year_id: taxYearId \} = taxReturnQuery.rows[0];\
    \
    // Update income form for specific year\
    const updateResult = await db.query(`\
      UPDATE income_forms SET\
        monthly_salary = $4,\
        bonus = $5,\
        car_allowance = $6,\
        other_taxable = $7,\
        salary_tax_deducted = $8,\
        multiple_employer = $9,\
        additional_tax_deducted = $10,\
        medical_allowance = $11,\
        employer_contribution = $12,\
        other_exempt = $13,\
        other_sources = $14,\
        is_complete = $15,\
        last_updated_by = $2,\
        updated_at = NOW()\
      WHERE tax_return_id = $1 AND user_id = $2 AND user_email = $3 AND tax_year = $16\
      RETURNING \
        total_gross_income,\
        total_exempt_income,\
        total_taxable_income,\
        is_complete,\
        tax_year\
    `, [\
      taxReturnId, userId, userEmail,\
      formData.monthly_salary || 0,\
      formData.bonus || 0,\
      formData.car_allowance || 0,\
      formData.other_taxable || 0,\
      formData.salary_tax_deducted || 0,\
      formData.multiple_employer || null,\
      formData.additional_tax_deducted || 0,\
      formData.medical_allowance || 0,\
      formData.employer_contribution || 0,\
      formData.other_exempt || 0,\
      formData.other_sources || 0,\
      formData.is_complete || false,\
      taxYear\
    ]);\
    \
    if (updateResult.rows.length === 0) \{\
      return res.status(404).json(\{ error: 'Income form not found for this year' \});\
    \}\
    \
    // Log audit trail with tax year\
    await db.query(`\
      INSERT INTO audit_log (\
        user_id, user_email, action, table_name, record_id, \
        field_name, new_value, ip_address, user_agent, category\
      ) VALUES ($1, $2, 'update', 'income_forms', $3, $4, $5, $6, $7, $8)\
    `, [\
      userId, userEmail, taxReturnId, \
      `income_form_$\{taxYear\}`, JSON.stringify(formData), \
      req.ip, req.headers['user-agent'], `form_update_$\{taxYear\}`\
    ]);\
    \
    // Trigger recalculation if form is complete\
    if (formData.is_complete) \{\
      await triggerTaxCalculation(taxReturnId, userId, userEmail, taxYearId, taxYear);\
    \}\
    \
    res.json(\{\
      success: true,\
      data: updateResult.rows[0],\
      message: `Income form updated successfully for $\{taxYear\}`,\
      taxYear\
    \});\
    \
  \} catch (error) \{\
    console.error('Income form update error:', error);\
    res.status(500).json(\{ error: 'Failed to update income form' \});\
  \}\
\});\
\
// 7. CALCULATE TAX - Read from all form tables for specific year\
async function triggerTaxCalculation(taxReturnId, userId, userEmail, taxYearId, taxYear) \{\
  try \{\
    // Get all form data for specific year\
    const formsData = await db.query(`\
      SELECT \
        inf.*,\
        atf.total_adjustable_tax,\
        rf.total_reductions,\
        cf.total_credits,\
        df.total_deductions,\
        ftf.total_final_tax,\
        cgf.total_capital_gains_tax,\
        wf.net_worth_current_year\
      FROM income_forms inf\
      LEFT JOIN adjustable_tax_forms atf ON inf.tax_return_id = atf.tax_return_id\
      LEFT JOIN reductions_forms rf ON inf.tax_return_id = rf.tax_return_id\
      LEFT JOIN credits_forms cf ON inf.tax_return_id = cf.tax_return_id\
      LEFT JOIN deductions_forms df ON inf.tax_return_id = df.tax_return_id\
      LEFT JOIN final_tax_forms ftf ON inf.tax_return_id = ftf.tax_return_id\
      LEFT JOIN capital_gain_forms cgf ON inf.tax_return_id = cgf.tax_return_id\
      LEFT JOIN wealth_forms wf ON inf.tax_return_id = wf.tax_return_id\
      WHERE inf.tax_return_id = $1 AND inf.user_id = $2 AND inf.user_email = $3 \
      AND inf.tax_year_id = $4 AND inf.tax_year = $5\
    `, [taxReturnId, userId, userEmail, taxYearId, taxYear]);\
    \
    if (formsData.rows.length === 0) \{\
      throw new Error(`No form data found for calculation in $\{taxYear\}`);\
    \}\
    \
    const data = formsData.rows[0];\
    \
    // Get tax slabs for specific year\
    const taxSlabs = await db.query(`\
      SELECT ts.* FROM tax_slabs ts\
      WHERE ts.tax_year_id = $1\
      ORDER BY ts.slab_order\
    `, [taxYearId]);\
    \
    // Perform tax calculation\
    const calculation = \{\
      gross_income: data.total_gross_income || 0,\
      exempt_income: data.total_exempt_income || 0,\
      taxable_income: (data.total_gross_income || 0) - (data.total_deductions || 0),\
      normal_tax: calculateNormalTax(\
        (data.total_gross_income || 0) - (data.total_deductions || 0),\
        taxSlabs.rows\
      ),\
      tax_reductions: data.total_reductions || 0,\
      tax_credits: data.total_credits || 0,\
      final_tax: data.total_final_tax || 0,\
      capital_gains_tax: data.total_capital_gains_tax || 0,\
      adjustable_tax_paid: data.total_adjustable_tax || 0\
    \};\
    \
    // Calculate final amounts\
    calculation.total_tax_liability = Math.max(0, \
      calculation.normal_tax - calculation.tax_reductions - calculation.tax_credits\
    ) + calculation.final_tax + calculation.capital_gains_tax;\
    \
    calculation.total_tax_paid = (data.salary_tax_deducted || 0) + \
      (data.additional_tax_deducted || 0) + calculation.adjustable_tax_paid;\
    \
    const difference = calculation.total_tax_paid - calculation.total_tax_liability;\
    calculation.refund_due = Math.max(0, difference);\
    calculation.additional_tax_due = Math.max(0, -difference);\
    \
    // Save calculation with tax year information\
    const calcResult = await db.query(`\
      INSERT INTO tax_calculations (\
        tax_return_id, user_id, user_email, tax_year_id, tax_year, \
        calculation_type, calculation_version,\
        gross_income, exempt_income, taxable_income, normal_tax, tax_reductions,\
        tax_credits, final_tax, capital_gains_tax, total_tax_liability,\
        total_tax_paid, refund_due, additional_tax_due, is_final\
      ) VALUES (\
        $1, $2, $3, $4, $5, 'auto', '1.0',\
        $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, true\
      ) RETURNING id\
    `, [\
      taxReturnId, userId, userEmail, taxYearId, taxYear,\
      calculation.gross_income, calculation.exempt_income, calculation.taxable_income,\
      calculation.normal_tax, calculation.tax_reductions, calculation.tax_credits,\
      calculation.final_tax, calculation.capital_gains_tax, calculation.total_tax_liability,\
      calculation.total_tax_paid, calculation.refund_due, calculation.additional_tax_due\
    ]);\
    \
    // Update tax return summary\
    await db.query(`\
      UPDATE tax_returns SET\
        total_income = $2,\
        taxable_income = $3,\
        total_tax_liability = $4,\
        tax_paid = $5,\
        refund_due = $6,\
        additional_tax_due = $7,\
        updated_at = NOW()\
      WHERE id = $1\
    `, [\
      taxReturnId,\
      calculation.gross_income,\
      calculation.taxable_income,\
      calculation.total_tax_liability,\
      calculation.total_tax_paid,\
      calculation.refund_due,\
      calculation.additional_tax_due\
    ]);\
    \
    // Log calculation audit\
    await db.query(`\
      INSERT INTO audit_log (\
        user_id, user_email, action, table_name, record_id, \
        change_summary, category\
      ) VALUES ($1, $2, 'calculate', 'tax_calculations', $3, $4, $5)\
    `, [\
      userId, userEmail, calcResult.rows[0].id,\
      `Tax calculated for $\{taxYear\}: Liability $\{calculation.total_tax_liability\}`,\
      `tax_calculation_$\{taxYear\}`\
    ]);\
    \
    return calculation;\
    \
  \} catch (error) \{\
    console.error(`Tax calculation error for $\{taxYear\}:`, error);\
    throw error;\
  \}\
\}\
\
// 8. COPY TAX DATA FROM PREVIOUS YEAR - Multi-year functionality\
app.post('/api/tax-forms/copy-from-previous/:fromYear/:toYear', async (req, res) => \{\
  const client = await db.getClient();\
  \
  try \{\
    await client.query('BEGIN');\
    \
    const \{ fromYear, toYear \} = req.params;\
    const \{ userId, userEmail \} = req.body;\
    \
    // Validate user and get tax years\
    const taxYearsQuery = await client.query(`\
      SELECT \
        ty_from.id as from_year_id,\
        ty_to.id as to_year_id,\
        ty_from.tax_year as from_year,\
        ty_to.tax_year as to_year\
      FROM tax_years ty_from, tax_years ty_to\
      WHERE ty_from.tax_year = $1 AND ty_to.tax_year = $2\
      AND ty_from.is_active = true AND ty_to.is_active = true\
    `, [fromYear, toYear]);\
    \
    if (taxYearsQuery.rows.length === 0) \{\
      return res.status(404).json(\{ error: 'Tax years not found' \});\
    \}\
    \
    const \{ from_year_id, to_year_id, from_year, to_year \} = taxYearsQuery.rows[0];\
    \
    // Check if source tax return exists\
    const sourceReturn = await client.query(`\
      SELECT tr.id as tax_return_id\
      FROM tax_returns tr\
      WHERE tr.user_id = $1 AND tr.user_email = $2 AND tr.tax_year_id = $3\
    `, [userId, userEmail, from_year_id]);\
    \
    if (sourceReturn.rows.length === 0) \{\
      return res.status(404).json(\{ \
        error: 'Source tax return not found',\
        message: `No tax return found for $\{fromYear\} to copy from`\
      \});\
    \}\
    \
    // Check if destination tax return exists, create if not\
    let destReturnQuery = await client.query(`\
      SELECT tr.id as tax_return_id\
      FROM tax_returns tr\
      WHERE tr.user_id = $1 AND tr.user_email = $2 AND tr.tax_year_id = $3\
    `, [userId, userEmail, to_year_id]);\
    \
    let destTaxReturnId;\
    \
    if (destReturnQuery.rows.length === 0) \{\
      // Create new tax return for destination year\
      const newReturnResult = await client.query(`\
        INSERT INTO tax_returns (user_id, user_email, tax_year_id, return_type, filing_status)\
        VALUES ($1, $2, $3, 'individual', 'draft')\
        RETURNING id\
      `, [userId, userEmail, to_year_id]);\
      \
      destTaxReturnId = newReturnResult.rows[0].id;\
      \
      // Initialize forms for new year\
      await client.query(`\
        SELECT initialize_tax_forms($1, $2, $3, $4, $5)\
      `, [destTaxReturnId, userId, userEmail, to_year_id, to_year]);\
      \
    \} else \{\
      destTaxReturnId = destReturnQuery.rows[0].tax_return_id;\
    \}\
    \
    const sourceTaxReturnId = sourceReturn.rows[0].tax_return_id;\
    \
    // Copy form data (excluding calculated fields and IDs)\
    const formTables = [\
      'income_forms',\
      'adjustable_tax_forms', \
      'reductions_forms',\
      'credits_forms',\
      'deductions_forms',\
      'final_tax_forms',\
      'capital_gain_forms',\
      'expenses_forms',\
      'wealth_forms'\
    ];\
    \
    const copyResults = [];\
    \
    for (const tableName of formTables) \{\
      // Get source data\
      const sourceData = await client.query(`\
        SELECT * FROM $\{tableName\} \
        WHERE tax_return_id = $1 AND user_id = $2 AND user_email = $3 AND tax_year = $4\
      `, [sourceTaxReturnId, userId, userEmail, fromYear]);\
      \
      if (sourceData.rows.length > 0) \{\
        const source = sourceData.rows[0];\
        \
        // Build dynamic update query excluding system fields\
        const excludeFields = [\
          'id', 'tax_return_id', 'tax_year_id', 'tax_year', 'created_at', 'updated_at',\
          'total_gross_income', 'total_exempt_income', 'total_taxable_income',\
          'total_adjustable_tax', 'total_reductions', 'total_credits', \
          'total_deductions', 'total_final_tax', 'total_capital_gains',\
          'total_capital_gains_tax', 'total_expenses', 'total_assets_previous_year',\
          'total_assets_current_year', 'total_liabilities_previous_year',\
          'total_liabilities_current_year', 'net_worth_previous_year',\
          'net_worth_current_year', 'wealth_increase'\
        ];\
        \
        const updateFields = Object.keys(source).filter(key => !excludeFields.includes(key));\
        const setClause = updateFields.map((field, index) => `$\{field\} = $\{index + 6\}`).join(', ');\
        const values = updateFields.map(field => source[field]);\
        \
        if (updateFields.length > 0) \{\
          const updateQuery = `\
            UPDATE $\{tableName\} SET\
              $\{setClause\},\
              last_updated_by = $2,\
              updated_at = NOW()\
            WHERE tax_return_id = $1 AND user_id = $2 AND user_email = $3 \
            AND tax_year_id = $4 AND tax_year = $5\
          `;\
          \
          await client.query(updateQuery, [\
            destTaxReturnId, userId, userEmail, to_year_id, to_year,\
            ...values\
          ]);\
          \
          copyResults.push(\{\
            form: tableName,\
            fieldsCopied: updateFields.length,\
            status: 'success'\
          \});\
        \}\
      \}\
    \}\
    \
    await client.query('COMMIT');\
    \
    // Log the copy operation\
    await db.query(`\
      INSERT INTO audit_log (\
        user_id, user_email, action, table_name, record_id,\
        change_summary, category\
      ) VALUES ($1, $2, 'copy_tax_data', 'tax_returns', $3, $4, $5)\
    `, [\
      userId, userEmail, destTaxReturnId,\
      `Copied tax data from $\{fromYear\} to $\{toYear\}`,\
      `tax_copy_$\{fromYear\}_to_$\{toYear\}`\
    ]);\
    \
    res.json(\{\
      success: true,\
      message: `Tax data copied from $\{fromYear\} to $\{toYear\}`,\
      copyResults,\
      fromYear,\
      toYear,\
      destTaxReturnId\
    \});\
    \
  \} catch (error) \{\
    await client.query('ROLLBACK');\
    console.error('Copy tax data error:', error);\
    res.status(500).json(\{ error: 'Failed to copy tax data' \});\
  \} finally \{\
    client.release();\
  \}\
\});\
\
// =============================================\
// FRONTEND MULTI-YEAR TAX MANAGEMENT\
// =============================================\
\
// Frontend React Component - Multi-year tax management\
const MultiYearTaxDashboard = () => \{\
  const [taxYearsSummary, setTaxYearsSummary] = useState([]);\
  const [selectedYear, setSelectedYear] = useState('2024-25');\
  const [currentYearData, setCurrentYearData] = useState(null);\
  const [loading, setLoading] = useState(true);\
  \
  useEffect(() => \{\
    loadTaxYearsSummary();\
  \}, []);\
  \
  useEffect(() => \{\
    if (selectedYear) \{\
      loadYearSpecificData(selectedYear);\
    \}\
  \}, [selectedYear]);\
  \
  const loadTaxYearsSummary = async () => \{\
    try \{\
      const response = await fetch(`/api/tax-years-summary/$\{user.id\}`, \{\
        headers: \{\
          'Authorization': `Bearer $\{sessionToken\}`,\
          'Content-Type': 'application/json'\
        \}\
      \});\
      \
      if (response.ok) \{\
        const data = await response.json();\
        setTaxYearsSummary(data.data);\
        \
        // Set current year as default if available\
        const currentYear = data.data.find(year => year.is_current_year);\
        if (currentYear) \{\
          setSelectedYear(currentYear.tax_year);\
        \}\
      \}\
    \} catch (error) \{\
      console.error('Error loading tax years summary:', error);\
    \}\
  \};\
  \
  const loadYearSpecificData = async (taxYear) => \{\
    try \{\
      setLoading(true);\
      const response = await fetch(`/api/tax-forms/$\{user.id\}/$\{taxYear\}`, \{\
        headers: \{\
          'Authorization': `Bearer $\{sessionToken\}`,\
          'Content-Type': 'application/json'\
        \}\
      \});\
      \
      if (response.ok) \{\
        const data = await response.json();\
        setCurrentYearData(data.data);\
      \} else if (response.status === 404) \{\
        // No tax return exists for this year\
        setCurrentYearData(null);\
      \}\
    \} catch (error) \{\
      console.error('Error loading year data:', error);\
    \} finally \{\
      setLoading(false);\
    \}\
  \};\
  \
  const createNewTaxReturn = async (taxYear) => \{\
    try \{\
      const response = await fetch(`/api/tax-returns/create/$\{taxYear\}`, \{\
        method: 'POST',\
        headers: \{\
          'Authorization': `Bearer $\{sessionToken\}`,\
          'Content-Type': 'application/json'\
        \},\
        body: JSON.stringify(\{\
          userId: user.id,\
          userEmail: user.email\
        \})\
      \});\
      \
      if (response.ok) \{\
        const result = await response.json();\
        toast.success(`Tax return created for $\{taxYear\}`);\
        \
        // Reload data\
        await loadTaxYearsSummary();\
        await loadYearSpecificData(taxYear);\
      \} else \{\
        const error = await response.json();\
        toast.error(error.error || 'Failed to create tax return');\
      \}\
    \} catch (error) \{\
      console.error('Error creating tax return:', error);\
      toast.error('Failed to create tax return');\
    \}\
  \};\
  \
  const copyFromPreviousYear = async (fromYear, toYear) => \{\
    try \{\
      const response = await fetch(`/api/tax-forms/copy-from-previous/$\{fromYear\}/$\{toYear\}`, \{\
        method: 'POST',\
        headers: \{\
          'Authorization': `Bearer $\{sessionToken\}`,\
          'Content-Type': 'application/json'\
        \},\
        body: JSON.stringify(\{\
          userId: user.id,\
          userEmail: user.email\
        \})\
      \});\
      \
      if (response.ok) \{\
        const result = await response.json();\
        toast.success(`Tax data copied from $\{fromYear\} to $\{toYear\}`);\
        \
        // Reload data\
        await loadTaxYearsSummary();\
        await loadYearSpecificData(toYear);\
      \} else \{\
        const error = await response.json();\
        toast.error(error.error || 'Failed to copy tax data');\
      \}\
    \} catch (error) \{\
      console.error('Error copying tax data:', error);\
      toast.error('Failed to copy tax data');\
    \}\
  \};\
  \
  return (\
    <div className="multi-year-tax-dashboard">\
      <div className="dashboard-header">\
        <h1>Tax Returns Dashboard</h1>\
        <p>Manage your tax returns across multiple years</p>\
      </div>\
      \
      \{/* Tax Years Summary */\}\
      <div className="tax-years-summary">\
        <h2>Tax Years Overview</h2>\
        <div className="years-grid">\
          \{taxYearsSummary.map(year => (\
            <div \
              key=\{year.tax_year\} \
              className=\{`year-card $\{selectedYear === year.tax_year ? 'selected' : ''\}`\}\
              onClick=\{() => setSelectedYear(year.tax_year)\}\
            >\
              <div className="year-header">\
                <h3>\{year.tax_year\}</h3>\
                \{year.is_current_year && <span className="current-badge">Current</span>\}\
              </div>\
              \
              <div className="year-status">\
                <div className="filing-status">\
                  Status: \{year.filing_status || 'Not Started'\}\
                </div>\
                <div className="completion">\
                  \{year.completion_percentage\}% Complete\
                </div>\
              </div>\
              \
              \{year.tax_return_id ? (\
                <div className="year-summary">\
                  <div>Income: \{currency(year.total_income)\}</div>\
                  <div>Tax Liability: \{currency(year.total_tax_liability)\}</div>\
                  \{year.refund_due > 0 && (\
                    <div className="refund">Refund: \{currency(year.refund_due)\}</div>\
                  )\}\
                  \{year.additional_tax_due > 0 && (\
                    <div className="additional-tax">Due: \{currency(year.additional_tax_due)\}</div>\
                  )\}\
                </div>\
              ) : (\
                <div className="no-return">\
                  <p>No tax return for this year</p>\
                  <button \
                    onClick=\{(e) => \{\
                      e.stopPropagation();\
                      createNewTaxReturn(year.tax_year);\
                    \}\}\
                    className="create-return-btn"\
                  >\
                    Create Return\
                  </button>\
                </div>\
              )\}\
            </div>\
          ))\}\
        </div>\
      </div>\
      \
      \{/* Selected Year Details */\}\
      <div className="selected-year-details">\
        <div className="year-header">\
          <h2>Tax Return for \{selectedYear\}</h2>\
          \
          \{currentYearData && (\
            <div className="year-actions">\
              <button \
                onClick=\{() => \{\
                  const previousYear = taxYearsSummary.find(y => \
                    y.tax_year < selectedYear && y.tax_return_id\
                  );\
                  if (previousYear) \{\
                    copyFromPreviousYear(previousYear.tax_year, selectedYear);\
                  \} else \{\
                    toast.info('No previous year data found to copy from');\
                  \}\
                \}\}\
                className="copy-data-btn"\
              >\
                Copy from Previous Year\
              </button>\
            </div>\
          )\}\
        </div>\
        \
        \{loading ? (\
          <div className="loading">Loading tax data for \{selectedYear\}...</div>\
        ) : currentYearData ? (\
          <TaxFormsContainer \
            taxData=\{currentYearData\}\
            taxYear=\{selectedYear\}\
            onDataUpdate=\{(updatedData) => \{\
              setCurrentYearData(updatedData);\
              loadTaxYearsSummary(); // Refresh summary\
            \}\}\
          />\
        ) : (\
          <div className="no-data">\
            <h3>No tax return found for \{selectedYear\}</h3>\
            <p>Create a new tax return to start entering your tax information.</p>\
            <button \
              onClick=\{() => createNewTaxReturn(selectedYear)\}\
              className="create-return-btn primary"\
            >\
              Create Tax Return for \{selectedYear\}\
            </button>\
          </div>\
        )\}\
      </div>\
    </div>\
  );\
\};\
\
// Enhanced Form Component with Year Context\
const TaxFormsContainer = (\{ taxData, taxYear, onDataUpdate \}) => \{\
  const [activeTab, setActiveTab] = useState('income');\
  \
  const updateForm = async (formType, formData) => \{\
    try \{\
      const response = await fetch(`/api/tax-forms/$\{formType\}/$\{taxYear\}`, \{\
        method: 'PUT',\
        headers: \{\
          'Authorization': `Bearer $\{sessionToken\}`,\
          'Content-Type': 'application/json'\
        \},\
        body: JSON.stringify(\{\
          userId: user.id,\
          userEmail: user.email,\
          formData\
        \})\
      \});\
      \
      if (response.ok) \{\
        const result = await response.json();\
        \
        // Update local state\
        const updatedTaxData = \{\
          ...taxData,\
          forms: \{\
            ...taxData.forms,\
            [formType]: \{\
              ...taxData.forms[formType],\
              ...formData,\
              ...result.data // Include calculated fields\
            \}\
          \}\
        \};\
        \
        onDataUpdate(updatedTaxData);\
        toast.success(`$\{formType\} form updated for $\{taxYear\}`);\
        \
      \} else \{\
        const error = await response.json();\
        toast.error(error.error || `Failed to update $\{formType\} form`);\
      \}\
    \} catch (error) \{\
      console.error(`Error updating $\{formType\} form:`, error);\
      toast.error(`Failed to update $\{formType\} form`);\
    \}\
  \};\
  \
  return (\
    <div className="tax-forms-container">\
      <div className="forms-header">\
        <h3>Tax Forms for \{taxYear\}</h3>\
        <div className="completion-status">\
          Completion: \{taxData.completionStatus?.completion_percentage || 0\}%\
        </div>\
      </div>\
      \
      <div className="forms-tabs">\
        \{/* Tab navigation */\}\
        <div className="tab-list">\
          \{/* Render tabs for different forms */\}\
        </div>\
        \
        <div className="tab-content">\
          \{/* Render active form with year context */\}\
          <FormComponent \
            formType=\{activeTab\}\
            formData=\{taxData.forms[activeTab]\}\
            taxYear=\{taxYear\}\
            onUpdate=\{(formData) => updateForm(activeTab, formData)\}\
          />\
        </div>\
      </div>\
      \
      \{/* Tax calculation summary for this year */\}\
      \{taxData.calculationSummary && (\
        <div className="calculation-summary">\
          <h4>Tax Calculation Summary for \{taxYear\}</h4>\
          <div className="summary-grid">\
            <div>Total Income: \{currency(taxData.calculationSummary.gross_income)\}</div>\
            <div>Taxable Income: \{currency(taxData.calculationSummary.taxable_income)\}</div>\
            <div>Tax Liability: \{currency(taxData.calculationSummary.total_tax_liability)\}</div>\
            <div>Tax Paid: \{currency(taxData.calculationSummary.total_tax_paid)\}</div>\
            \{taxData.calculationSummary.refund_due > 0 && (\
              <div className="refund">Refund Due: \{currency(taxData.calculationSummary.refund_due)\}</div>\
            )\}\
            \{taxData.calculationSummary.additional_tax_due > 0 && (\
              <div className="additional-tax">Additional Tax: \{currency(taxData.calculationSummary.additional_tax_due)\}</div>\
            )\}\
          </div>\
        </div>\
      )\}\
    </div>\
  );\
\};\
\
// =============================================\
// ADVANCED MULTI-YEAR QUERIES & REPORTING\
// =============================================\
\
// 9. YEAR-OVER-YEAR COMPARISON REPORT\
app.get('/api/reports/year-over-year/:userId/:year1/:year2', async (req, res) => \{\
  try \{\
    const \{ userId, year1, year2 \} = req.params;\
    const userEmail = req.user.email;\
    \
    // Get comparison data for two years\
    const comparisonData = await db.query(`\
      WITH year_data AS (\
        SELECT \
          ty.tax_year,\
          inf.total_gross_income,\
          inf.total_taxable_income,\
          tc.total_tax_liability,\
          tc.refund_due,\
          tc.additional_tax_due,\
          wf.net_worth_current_year\
        FROM tax_years ty\
        LEFT JOIN tax_returns tr ON ty.id = tr.tax_year_id AND tr.user_id = $1\
        LEFT JOIN income_forms inf ON tr.id = inf.tax_return_id\
        LEFT JOIN tax_calculations tc ON tr.id = tc.tax_return_id AND tc.is_final = true\
        LEFT JOIN wealth_forms wf ON tr.id = wf.tax_return_id\
        WHERE ty.tax_year IN ($2, $3) AND ty.is_active = true\
      )\
      SELECT \
        tax_year,\
        COALESCE(total_gross_income, 0) as gross_income,\
        COALESCE(total_taxable_income, 0) as taxable_income,\
        COALESCE(total_tax_liability, 0) as tax_liability,\
        COALESCE(refund_due, 0) as refund_due,\
        COALESCE(additional_tax_due, 0) as additional_tax_due,\
        COALESCE(net_worth_current_year, 0) as net_worth\
      FROM year_data\
      ORDER BY tax_year\
    `, [userId, year1, year2]);\
    \
    if (comparisonData.rows.length < 2) \{\
      return res.status(404).json(\{ \
        error: 'Insufficient data for comparison',\
        message: 'Both years must have complete tax returns for comparison'\
      \});\
    \}\
    \
    const [yearData1, yearData2] = comparisonData.rows;\
    \
    // Calculate changes\
    const comparison = \{\
      year1: yearData1.tax_year,\
      year2: yearData2.tax_year,\
      income_change: yearData2.gross_income - yearData1.gross_income,\
      income_change_percent: yearData1.gross_income > 0 ? \
        ((yearData2.gross_income - yearData1.gross_income) / yearData1.gross_income * 100) : 0,\
      tax_change: yearData2.tax_liability - yearData1.tax_liability,\
      tax_change_percent: yearData1.tax_liability > 0 ? \
        ((yearData2.tax_liability - yearData1.tax_liability) / yearData1.tax_liability * 100) : 0,\
      wealth_change: yearData2.net_worth - yearData1.net_worth,\
      effective_tax_rate_1: yearData1.gross_income > 0 ? \
        (yearData1.tax_liability / yearData1.gross_income * 100) : 0,\
      effective_tax_rate_2: yearData2.gross_income > 0 ? \
        (yearData2.tax_liability / yearData2.gross_income * 100) : 0\
    \};\
    \
    res.json(\{\
      success: true,\
      comparison,\
      yearData: comparisonData.rows\
    \});\
    \
  \} catch (error) \{\
    console.error('Year-over-year comparison error:', error);\
    res.status(500).json(\{ error: 'Failed to generate comparison report' \});\
  \}\
\});\
\
// 10. BULK OPERATIONS - Update multiple years\
app.put('/api/tax-forms/bulk-update/:formType', async (req, res) => \{\
  const client = await db.getClient();\
  \
  try \{\
    await client.query('BEGIN');\
    \
    const \{ formType \} = req.params;\
    const \{ userId, userEmail, updates \} = req.body; // updates is array of \{taxYear, formData\}\
    \
    const validFormTypes = [\
      'income_forms', 'adjustable_tax_forms', 'reductions_forms',\
      'credits_forms', 'deductions_forms', 'final_tax_forms',\
      'capital_gain_forms', 'expenses_forms', 'wealth_forms'\
    ];\
    \
    if (!validFormTypes.includes(formType)) \{\
      return res.status(400).json(\{ error: 'Invalid form type' \});\
    \}\
    \
    const results = [];\
    \
    for (const \{ taxYear, formData \} of updates) \{\
      // Get tax return for this year\
      const taxReturnQuery = await client.query(`\
        SELECT tr.id as tax_return_id, ty.id as tax_year_id\
        FROM tax_returns tr\
        JOIN tax_years ty ON tr.tax_year_id = ty.id\
        WHERE tr.user_id = $1 AND tr.user_email = $2 AND ty.tax_year = $3\
      `, [userId, userEmail, taxYear]);\
      \
      if (taxReturnQuery.rows.length > 0) \{\
        const \{ tax_return_id, tax_year_id \} = taxReturnQuery.rows[0];\
        \
        // Build dynamic update query\
        const updateFields = Object.keys(formData);\
        const setClause = updateFields.map((field, index) => `$\{field\} = $\{index + 6\}`).join(', ');\
        const values = updateFields.map(field => formData[field]);\
        \
        if (updateFields.length > 0) \{\
          const updateQuery = `\
            UPDATE $\{formType\} SET\
              $\{setClause\},\
              last_updated_by = $2,\
              updated_at = NOW()\
            WHERE tax_return_id = $1 AND user_id = $2 AND user_email = $3 \
            AND tax_year_id = $4 AND tax_year = $5\
          `;\
          \
          await client.query(updateQuery, [\
            tax_return_id, userId, userEmail, tax_year_id, taxYear,\
            ...values\
          ]);\
          \
          results.push(\{\
            taxYear,\
            status: 'updated',\
            fieldsUpdated: updateFields.length\
          \});\
          \
          // Log audit\
          await client.query(`\
            INSERT INTO audit_log (\
              user_id, user_email, action, table_name, record_id,\
              change_summary, category\
            ) VALUES ($1, $2, 'bulk_update', $3, $4, $5, $6)\
          `, [\
            userId, userEmail, formType, tax_return_id,\
            `Bulk update for $\{taxYear\}: $\{updateFields.join(', ')\}`,\
            `bulk_update_$\{formType\}`\
          ]);\
        \}\
      \} else \{\
        results.push(\{\
          taxYear,\
          status: 'skipped',\
          reason: 'Tax return not found'\
        \});\
      \}\
    \}\
    \
    await client.query('COMMIT');\
    \
    res.json(\{\
      success: true,\
      message: `Bulk update completed for $\{formType\}`,\
      results\
    \});\
    \
  \} catch (error) \{\
    await client.query('ROLLBACK');\
    console.error('Bulk update error:', error);\
    res.status(500).json(\{ error: 'Bulk update failed' \});\
  \} finally \{\
    client.release();\
  \}\
\});\
\
// Helper function for normal tax calculation\
function calculateNormalTax(taxableIncome, taxSlabs) \{\
  let tax = 0;\
  let remainingIncome = taxableIncome;\
  \
  for (const slab of taxSlabs) \{\
    if (remainingIncome <= 0) break;\
    \
    const slabIncome = Math.min(\
      remainingIncome,\
      (slab.max_income || Infinity) - slab.min_income + 1\
    );\
    \
    if (taxableIncome > slab.min_income) \{\
      tax += slabIncome * slab.tax_rate;\
      remainingIncome -= slabIncome;\
    \}\
  \}\
  \
  return Math.round(tax);\
\}\
\
// =============================================\
// DATA SYNCHRONIZATION FLOW WITH TAX YEARS\
// =============================================\
\
/*\
ENHANCED DATA FLOW WITH MULTI-YEAR SUPPORT:\
\
1. USER LOGIN WITH MULTI-YEAR DATA:\
   \uc0\u9484 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9488     \u9484 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9488     \u9484 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9488 \
   \uc0\u9474   Frontend   \u9474 \u9472 \u9472 \u9472 \u9654 \u9474    Backend API   \u9474 \u9472 \u9472 \u9472 \u9654 \u9474   Database Queries   \u9474 \
   \uc0\u9474   Login Form \u9474     \u9474   /api/login     \u9474     \u9474   - User validation  \u9474 \
   \uc0\u9492 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496     \u9492 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496     \u9474   - Tax years summary\u9474 \
                              \uc0\u9474               \u9474   - Current year data\u9474 \
                              \uc0\u9660               \u9492 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496 \
                      \uc0\u9484 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9488                   \u9474 \
                      \uc0\u9474   Response   \u9474 \u9664 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496 \
                      \uc0\u9474   - User info\u9474 \
                      \uc0\u9474   - All years\u9474 \
                      \uc0\u9474   - Current  \u9474 \
                      \uc0\u9492 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496 \
\
2. MULTI-YEAR FORM MANAGEMENT:\
   \uc0\u9484 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9488     \u9484 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9488     \u9484 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9488 \
   \uc0\u9474   Year       \u9474 \u9472 \u9472 \u9472 \u9654 \u9474    Form Update   \u9474 \u9472 \u9472 \u9472 \u9654 \u9474   Year-Specific      \u9474 \
   \uc0\u9474   Selection  \u9474     \u9474    API Call      \u9474     \u9474   Table Update       \u9474 \
   \uc0\u9492 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496     \u9492 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496     \u9492 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496 \
                              \uc0\u9474                       \u9474 \
                              \uc0\u9660                       \u9660 \
                      \uc0\u9484 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9488     \u9484 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9488 \
                      \uc0\u9474   Validation \u9474     \u9474   Tax Year Binding   \u9474 \
                      \uc0\u9474   - User ID  \u9474     \u9474   - tax_year_id      \u9474 \
                      \uc0\u9474   - Email    \u9474     \u9474   - tax_year string  \u9474 \
                      \uc0\u9474   - Tax Year \u9474     \u9474   - Unique constraints\u9474 \
                      \uc0\u9492 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496     \u9492 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496 \
\
3. YEAR-SPECIFIC TAX CALCULATION:\
   \uc0\u9484 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9488     \u9484 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9488     \u9484 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9488 \
   \uc0\u9474   Form       \u9474 \u9472 \u9472 \u9472 \u9654 \u9474    Tax Engine    \u9474 \u9472 \u9472 \u9472 \u9654 \u9474   Year-Specific      \u9474 \
   \uc0\u9474   Completion \u9474     \u9474    for Year      \u9474     \u9474   Tax Rules & Slabs  \u9474 \
   \uc0\u9492 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496     \u9492 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496     \u9492 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496 \
                              \uc0\u9474                       \u9474 \
                              \uc0\u9660                       \u9660 \
                      \uc0\u9484 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9488     \u9484 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9488 \
                      \uc0\u9474   Calculate  \u9474     \u9474   Save to            \u9474 \
                      \uc0\u9474   Using      \u9474     \u9474   tax_calculations   \u9474 \
                      \uc0\u9474   Year Rules \u9474     \u9474   with tax_year      \u9474 \
                      \uc0\u9492 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496     \u9492 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496 \
\
4. MULTI-YEAR REPORTING & ANALYTICS:\
   \uc0\u9484 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9488     \u9484 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9488     \u9484 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9488 \
   \uc0\u9474   Report     \u9474 \u9472 \u9472 \u9472 \u9654 \u9474    Cross-Year    \u9474 \u9472 \u9472 \u9472 \u9654 \u9474   Aggregate Queries  \u9474 \
   \uc0\u9474   Request    \u9474     \u9474    Analytics     \u9474     \u9474   Across Years       \u9474 \
   \uc0\u9492 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496     \u9492 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496     \u9492 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496 \
                              \uc0\u9474                       \u9474 \
                              \uc0\u9660                       \u9660 \
                      \uc0\u9484 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9488     \u9484 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9488 \
                      \uc0\u9474   Comparison \u9474     \u9474   Year-over-Year     \u9474 \
                      \uc0\u9474   Calculation\u9474     \u9474   Trend Analysis     \u9474 \
                      \uc0\u9492 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496     \u9492 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9472 \u9496 \
\
KEY INDEXING BENEFITS:\
\
\uc0\u9989  **Fast Year-Specific Queries**:\
   - Indexes on (user_id, tax_year_id) for instant form retrieval\
   - Indexes on (user_id, user_email, tax_year) for security + performance\
   - Separate indexes per tax year for parallel processing\
\
\uc0\u9989  **Multi-Year Operations**:\
   - Efficient year-over-year comparisons\
   - Bulk operations across multiple years\
   - Historical data analysis and reporting\
\
\uc0\u9989  **Data Integrity**:\
   - Unique constraints prevent duplicate forms per user per year\
   - Foreign key constraints ensure referential integrity\
   - Check constraints validate tax year consistency\
\
\uc0\u9989  **Scalability**:\
   - Can handle millions of tax returns across decades\
   - Efficient archiving of old tax years\
   - Parallel processing of different tax years\
\
SAMPLE QUERIES ENABLED BY TAX YEAR INDEXING:\
\
-- Get user's income across all years (super fast with indexes)\
SELECT tax_year, total_gross_income, total_taxable_income\
FROM income_forms \
WHERE user_id = 'user-uuid' AND user_email = 'user@email.com'\
ORDER BY tax_year DESC;\
\
-- Compare wealth across years\
SELECT tax_year, net_worth_current_year,\
       LAG(net_worth_current_year) OVER (ORDER BY tax_year) as previous_year_wealth,\
       net_worth_current_year - LAG(net_worth_current_year) OVER (ORDER BY tax_year) as wealth_change\
FROM wealth_forms \
WHERE user_id = 'user-uuid'\
ORDER BY tax_year;\
\
-- Get all incomplete forms across all years\
SELECT tax_year, \
       CASE WHEN NOT income_form_complete THEN 'income' END as incomplete_forms\
FROM form_completion_status \
WHERE user_id = 'user-uuid' AND completion_percentage < 100;\
\
-- Year-over-year tax efficiency\
SELECT tax_year,\
       total_tax_liability,\
       gross_income,\
       (total_tax_liability::decimal / NULLIF(gross_income, 0) * 100) as effective_rate\
FROM tax_calculations tc\
JOIN income_forms inf ON tc.tax_return_id = inf.tax_return_id\
WHERE tc.user_id = 'user-uuid' AND tc.is_final = true\
ORDER BY tax_year;\
\
DATABASE PARTITIONING READY:\
The schema is designed to support table partitioning by tax year for even better performance:\
\
-- Future partitioning by tax year\
CREATE TABLE income_forms_2024_25 PARTITION OF income_forms \
FOR VALUES IN ('2024-25');\
\
CREATE TABLE income_forms_2025_26 PARTITION OF income_forms \
FOR VALUES IN ('2025-26');\
\
This enables:\
- Faster queries (only scan relevant partitions)\
- Easier archiving (drop old partitions)\
- Parallel maintenance operations\
- Better backup/restore strategies\
*/}