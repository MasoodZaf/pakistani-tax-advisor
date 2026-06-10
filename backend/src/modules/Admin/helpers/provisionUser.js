// provisionUser — shared user-creation core used by both the single admin
// "create user" flow and the tax-consultant bulk Excel import. Keeping this in
// one place means a bulk-imported user is seeded identically to an admin-created
// one: the users row PLUS a draft tax_return for the current year and the empty
// per-form rows the app expects.
//
// Caller responsibilities (NOT done here, so the caller controls the transaction
// and the user-facing validation/dedup messaging):
//   * run inside an open transaction `client` (BEGIN already issued)
//   * pre-hash the password (bcrypt) and pre-validate email/name uniqueness
//   * write the audit row and COMMIT/ROLLBACK
//
// Returns the new user row { id, email, name, user_type, role, is_active, created_at }.

const FORM_TABLES = [
  'income_forms',
  'adjustable_tax_forms',
  'reductions_forms',
  'credits_forms',
  'deductions_forms',
  'final_tax_forms',
  'capital_gain_forms',
  'expenses_forms',
  'wealth_forms',
  'form_completion_status',
];

async function provisionUser(
  client,
  { email, name, passwordHash, userType = 'individual', role = 'user', mustResetPassword = false }
) {
  const userResult = await client.query(
    `
    INSERT INTO users (
      id, email, name, password_hash, user_type, role,
      must_reset_password, is_active, created_at, updated_at
    )
    VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, true, NOW(), NOW())
    RETURNING id, email, name, user_type, role, is_active, created_at
  `,
    [email, name, passwordHash, userType, role, mustResetPassword]
  );

  const newUser = userResult.rows[0];

  // Seed the current-year draft return + empty form rows only for regular users.
  if (role === 'user') {
    const taxYearResult = await client.query(
      `SELECT id, tax_year FROM tax_years WHERE is_current = true AND is_active = true`
    );

    if (taxYearResult.rows.length > 0) {
      const currentTaxYear = taxYearResult.rows[0];

      const returnResult = await client.query(
        `
        INSERT INTO tax_returns (
          id, user_id, user_email, tax_year_id, tax_year,
          return_number, filing_status, filing_type, created_at
        )
        VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, 'draft', 'normal', NOW())
        RETURNING id
      `,
        [
          newUser.id,
          newUser.email,
          currentTaxYear.id,
          currentTaxYear.tax_year,
          `TR-${newUser.id}-${currentTaxYear.tax_year}`,
        ]
      );

      const taxReturnId = returnResult.rows[0].id;

      // Idempotent seed: DO NOTHING on the (user_id, tax_year) unique constraint.
      for (const tableName of FORM_TABLES) {
        await client.query(
          `
          INSERT INTO ${tableName} (
            id, tax_return_id, user_id, user_email,
            tax_year_id, tax_year, created_at
          ) VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, NOW())
          ON CONFLICT (user_id, tax_year) DO NOTHING
        `,
          [taxReturnId, newUser.id, newUser.email, currentTaxYear.id, currentTaxYear.tax_year]
        );
      }
    }
  }

  return newUser;
}

module.exports = { provisionUser };
