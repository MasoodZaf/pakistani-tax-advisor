# API Endpoints Reference Guide
**Last Updated:** October 6, 2025
**Backend URL:** http://localhost:3001/api

---

## 🔐 AUTHENTICATION ENDPOINTS

### 1. User Registration
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "User Name",
  "password": "securePassword123",
  "user_type": "individual"  // or "business"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "role": "user"
  },
  "currentTaxYear": "2025-26"
}
```

**Status:** ✅ Working - Creates user + initializes all form tables

---

### 2. User Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "khurramj@taxadvisor.pk",
  "password": "yourPassword"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "6bf47a47-5341-4884-9960-bb660dfdd9df",
    "email": "khurramj@taxadvisor.pk",
    "name": "Khurram Jamili",
    "role": "super_admin"
  },
  "token": "jwt-token-here",
  "sessionToken": "uuid-session-token",
  "isAdmin": true,
  "taxYearsSummary": [],
  "hasPersonalInfo": false
}
```

**Status:** ✅ Working - Returns JWT token for API calls

---

### 3. Verify Session
```http
POST /api/auth/verify-session
Content-Type: application/json

{
  "sessionToken": "uuid-from-login"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "role": "user"
  }
}
```

**Status:** ✅ Working

---

### 4. Logout
```http
POST /api/auth/logout
Content-Type: application/json

{
  "sessionToken": "uuid-from-login"
}
```

**Status:** ✅ Working - Removes session from database

---

### 5. Change Password
```http
POST /api/auth/change-password
Authorization: Bearer {jwt-token}
Content-Type: application/json

{
  "currentPassword": "oldPassword",
  "newPassword": "newPassword123"
}
```

**Status:** ✅ Working - Requires authentication

---

## 📋 PERSONAL INFORMATION ENDPOINTS

### 1. Get Personal Info
```http
GET /api/personal-info/:taxYear
Authorization: Bearer {jwt-token}
```

**Example:**
```bash
curl -X GET http://localhost:3001/api/personal-info/2025-26 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "tax_year": "2025-26",
  "full_name": "Khurram Jamili",
  "cnic": "12345-6789012-3",
  "date_of_birth": "1980-01-01",
  "mobile_number": "03001234567",
  "ntn": "NTN123456789",
  "residential_status": "resident"
}
```

**Status:** ✅ Working

---

### 2. Save/Update Personal Info
```http
POST /api/personal-info/:taxYear
Authorization: Bearer {jwt-token}
Content-Type: application/json

{
  "full_name": "Khurram Jamili",
  "cnic": "12345-6789012-3",
  "date_of_birth": "1980-01-01",
  "mobile_number": "03001234567",
  "ntn": "NTN123456789",
  "residential_status": "resident",
  "province": "punjab",
  "city": "Lahore"
}
```

**Status:** ✅ Working - UPSERT operation (creates or updates)

---

## 💰 INCOME FORM ENDPOINTS

### 1. Get Income Form
```http
GET /api/income-form/:taxYear
Authorization: Bearer {jwt-token}
```

**Example:**
```bash
curl -X GET http://localhost:3001/api/income-form/2025-26 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "tax_year": "2025-26",
  "annual_basic_salary": "7200000.00",
  "allowances": "0.00",
  "bonus": "1500000.00",
  "medical_allowance": "400000.00",
  "taxable_car_value": "50000.00",
  "employer_contribution_provident": "100000.00",
  "total_employment_income": "9350000.00",  // AUTO-CALCULATED
  "other_income_min_tax_total": "0.00",     // AUTO-CALCULATED
  "other_income_no_min_tax_total": "0.00",   // AUTO-CALCULATED
  "created_at": "2025-09-21T11:42:42.000Z",
  "updated_at": "2025-10-06T16:15:30.000Z"
}
```

**Status:** ✅ Working - Returns empty form if no data exists

---

### 2. Save/Update Income Form
```http
POST /api/income-form/:taxYear
Authorization: Bearer {jwt-token}
Content-Type: application/json

{
  "annual_basic_salary": 7200000,
  "bonus": 1500000,
  "taxable_car_value": 50000,
  "medical_allowance": 400000,
  "employer_contribution_provident": 100000,
  "allowances": 0,
  "other_taxable_income_rent": 0,
  "other_taxable_income_others": 0
}
```

**Response:**
```json
{
  "success": true,
  "message": "Income form saved successfully",
  "data": {
    "id": "uuid",
    "annual_basic_salary": "7200000.00",
    "bonus": "1500000.00",
    "total_employment_income": "9350000.00"  // AUTO-CALCULATED
  },
  "calculations": {
    "annual_basic_salary": 7200000,
    "total_employment_income": 9350000
  }
}
```

**Status:** ✅ Working - UPSERT with Excel-style calculations

---

### 3. Get Income Form Summary
```http
GET /api/income-form/:taxYear/summary
Authorization: Bearer {jwt-token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "employment_termination_total": "0.00",
    "total_non_cash_benefits": "50000.00",
    "other_income_min_tax_total": "0.00",
    "other_income_no_min_tax_total": "0.00",
    "income_exempt_from_tax": "-400000.00",
    "non_cash_benefit_exempt": "-100000.00",
    "total_income": "8750000.00",
    "updated_at": "2025-10-06T16:15:30.000Z"
  }
}
```

**Status:** ✅ Working - Returns calculated totals

---

### 4. Delete Income Form
```http
DELETE /api/income-form/:taxYear
Authorization: Bearer {jwt-token}
```

**Status:** ✅ Working

---

## 🧮 TAX COMPUTATION ENDPOINTS

### 1. Get Tax Computation (Excel-style calculation)
```http
GET /api/tax-computation/:taxYear
Authorization: Bearer {jwt-token}
```

**Example:**
```bash
curl -X GET http://localhost:3001/api/tax-computation/2025-26 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "income_from_salary": "8750000.00",
    "other_income_subject_to_min_tax": "0.00",
    "income_loss_other_sources": "0.00",
    "total_income": "8750000.00",           // GENERATED
    "deductible_allowances": "10000.00",
    "taxable_income_excluding_cg": "8740000.00",  // GENERATED
    "capital_gains_loss": "0.00",
    "taxable_income_including_cg": "8740000.00",  // GENERATED
    "normal_income_tax": "2324000.00",      // SQL FUNCTION
    "surcharge_amount": "0.00",             // GENERATED (10% if > 10M)
    "capital_gains_tax": "0.00",
    "normal_tax_including_surcharge_cgt": "2324000.00",  // GENERATED
    "tax_reductions": "586000.00",          // SQL FUNCTION
    "tax_credits": "146247.14",             // SQL FUNCTION
    "net_tax_payable": "1591752.86",        // GENERATED
    "final_fixed_tax": "600000.00",
    "total_tax_liability": "2191752.86",    // GENERATED
    "advance_tax_paid": "2200000.00",
    "balance_payable": "-8247.14"           // GENERATED (negative = refund)
  },
  "message": "Tax computation calculated successfully"
}
```

**Status:** ✅ Working - Automatically pulls from all forms + applies FBR tax slabs

---

### 2. Get Complete Tax Summary (All Forms Linked)
```http
GET /api/tax-computation/:taxYear/summary
Authorization: Bearer {jwt-token}
```

**Response:** Complete cross-form summary like Excel overview sheet

**Status:** ✅ Working

---

### 3. Get Income Data with Excel References
```http
GET /api/tax-computation/:taxYear/income-data
Authorization: Bearer {jwt-token}
```

**Response:**
```json
{
  "success": true,
  "data": { /* income form data */ },
  "excelReferences": {
    "B15": -400000,    // Income exempt from tax
    "B16": 8750000,    // Annual salary wages total
    "B22": -100000,    // Non-cash benefit exempt
    "B23": 50000,      // Total non-cash benefits
    "B28": 0,          // Other income min tax
    "B33": 0           // Other income no min tax
  }
}
```

**Status:** ✅ Working - Maps database to Excel cells

---

### 4. Get Adjustable Tax Data with Income Links
```http
GET /api/tax-computation/:taxYear/adjustable-data
Authorization: Bearer {jwt-token}
```

**Response:**
```json
{
  "success": true,
  "data": { /* adjustable tax data */ },
  "excelLinks": {
    "B5": "Income!B16 (Salary)",
    "B6": "Income!B13 (Directorship Fee)",
    "B7": "Income!B26 (Profit on Debt 15%)",
    "B8": "Income!B27 (Profit on Debt 12.5%)",
    "B9": "Income!B31 (Rent Income)"
  }
}
```

**Status:** ✅ Working - Shows Excel-style inter-form references

---

### 5. Update Inter-Form Links
```http
POST /api/tax-computation/:taxYear/update-links
Authorization: Bearer {jwt-token}
```

**Status:** ✅ Working - Recalculates all linked data

---

## 👤 ADMIN ENDPOINTS

### 1. Get All Users
```http
GET /api/admin/users
Authorization: Bearer {jwt-token}
```

**Requirements:** Admin or Super Admin role

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "role": "user",
      "is_active": true,
      "created_at": "2025-09-21T11:42:42.000Z"
    }
  ],
  "count": 10
}
```

**Status:** ✅ Working - Admin only

---

### 2. Get User Details
```http
GET /api/admin/users/:userId
Authorization: Bearer {jwt-token}
```

**Status:** ✅ Working - Admin only

---

### 3. Delete User
```http
DELETE /api/admin/users/:userId
Authorization: Bearer {jwt-token}
```

**Status:** ✅ Working - Super Admin only, soft delete

---

### 4. Get System Settings
```http
GET /api/admin/system-settings
Authorization: Bearer {jwt-token}
```

**Status:** ✅ Working - Admin only

---

### 5. Update System Settings
```http
PUT /api/admin/system-settings
Authorization: Bearer {jwt-token}
Content-Type: application/json

{
  "setting_key": "value"
}
```

**Status:** ✅ Working - Admin only

---

## 📊 EXCEL & REPORTS ENDPOINTS

### 1. Generate FBR Report
```http
POST /api/excel/generate-report
Authorization: Bearer {jwt-token}
Content-Type: application/json

{
  "taxYear": "2025-26",
  "format": "pdf"  // or "excel"
}
```

**Status:** ✅ Working - Generates FBR-compliant tax return

---

### 2. Get Reports List
```http
GET /api/reports
Authorization: Bearer {jwt-token}
```

**Status:** ✅ Working

---

## 🧪 TEST DATA ENDPOINTS

### 1. Populate Test Data
```http
POST /api/test-data/populate/:taxYear
Authorization: Bearer {jwt-token}
```

**Status:** ✅ Working - For development only

---

## 📝 CURL EXAMPLES FOR TESTING

### Test 1: Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "khurramj@taxadvisor.pk",
    "password": "yourPassword"
  }'
```

### Test 2: Get Income Form
```bash
# Replace YOUR_JWT_TOKEN with token from login response
curl -X GET http://localhost:3001/api/income-form/2025-26 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test 3: Update Income Form
```bash
curl -X POST http://localhost:3001/api/income-form/2025-26 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "annual_basic_salary": 7200000,
    "bonus": 1500000,
    "taxable_car_value": 50000
  }'
```

### Test 4: Get Tax Computation
```bash
curl -X GET http://localhost:3001/api/tax-computation/2025-26 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## ✅ ENDPOINT STATUS SUMMARY

| Endpoint Group | Count | Status | Notes |
|----------------|-------|--------|-------|
| Authentication | 5 | ✅ Working | Login, Register, Verify, Logout, Change Password |
| Personal Info | 2 | ✅ Working | GET, POST/UPDATE |
| Income Form | 4 | ✅ Working | GET, POST, DELETE, Summary |
| Tax Computation | 5 | ✅ Working | Auto-calculation with Excel formulas |
| Admin | 5 | ✅ Working | Role-based access control |
| Excel/Reports | 2 | ✅ Working | FBR report generation |
| Test Data | 1 | ✅ Working | Dev only |

**Total Endpoints:** 24
**All Working:** ✅ YES
**Database Operations:** ✅ FLAWLESS
**Excel Calculations:** ✅ ACCURATE

---

## 🔧 TROUBLESHOOTING

### Issue: "Invalid or expired session"
**Solution:** Login again to get a fresh JWT token

### Issue: "Authentication required"
**Solution:** Include `Authorization: Bearer {token}` header

### Issue: "No data found"
**Solution:** Check if data exists for the tax year, use POST to create

### Issue: 401 Unauthorized
**Solution:** Verify JWT token is valid and not expired

### Issue: 403 Forbidden
**Solution:** Check user role permissions for admin endpoints

---

## 📖 DATA FLOW

```
1. User logs in → receives JWT token
2. Token used for all subsequent API calls
3. POST /income-form → saves to income_forms table
4. Database auto-calculates total_employment_income (GENERATED column)
5. GET /tax-computation → pulls from all form tables
6. SQL functions calculate tax using FBR formulas
7. Returns complete tax computation matching Excel
```

---

**Last Tested:** October 6, 2025
**Test User:** khurramj@taxadvisor.pk
**All Endpoints:** ✅ VERIFIED WORKING
