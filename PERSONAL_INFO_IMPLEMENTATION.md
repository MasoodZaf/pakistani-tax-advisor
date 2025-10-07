# Personal Information Form Implementation

## Overview
This document describes the implementation of the Personal Information form feature that appears after user login and before accessing the main dashboard.

## Features
- **One-time setup**: Users only see this form once - after they complete it, they won't see it again for that tax year
- **FBR compliant**: Captures all required fields as per Federal Board of Revenue (FBR) requirements
- **Smart validation**: Client-side validation for CNIC (13 digits), NTN (7 digits), and Pakistani mobile numbers
- **User-friendly**: Auto-fills user email and name from registration data
- **Admin bypass**: Admin users skip this form entirely

## Database Structure

### Table: `personal_information`
```sql
- id (SERIAL PRIMARY KEY)
- user_id (UUID) - Foreign key to users table
- tax_year (VARCHAR) - Tax year in format "2025-26"
- full_name, father_name, cnic, ntn, passport_number
- residential_address, mailing_address, city, province, postal_code, country
- mobile_number, landline_number, email_address
- profession, employer_name, employer_address, employer_ntn
- fbr_registration_number, tax_circle, zone
- created_at, updated_at
```

**Unique Constraint**: `(user_id, tax_year)` - Each user can have one personal info record per tax year

**Migration File**: `database/create-personal-information-table.sql`

## Backend Implementation

### API Endpoints

#### 1. Get Personal Info
```
GET /api/personal-info/:taxYear
```
Returns personal information for the logged-in user and specified tax year.

**Response**:
- If found: `{ success: true, data: {...} }`
- If not found: `{ success: true, data: null }`

#### 2. Save Personal Info
```
POST /api/personal-info/:taxYear
```
Creates or updates personal information for the logged-in user.

**Request Body**: All personal info fields (see database structure)

**Response**: `{ success: true, data: {...}, message: "..." }`

#### 3. Delete Personal Info
```
DELETE /api/personal-info/:taxYear
```
Deletes personal information for the logged-in user.

### Authentication Middleware
All endpoints use JWT-based authentication via the `requireAuth` middleware.

### Login Response Enhancement
The `/api/login` endpoint now returns:
```javascript
{
  success: true,
  user: {...},
  hasPersonalInfo: boolean,  // NEW: Indicates if user has completed personal info
  ...
}
```

**File**: `backend/src/routes/personalInfo.js`

## Frontend Implementation

### Component: PersonalInfoForm
**Location**: `Frontend/src/components/PersonalInfo/PersonalInfoForm.js`

**Features**:
- Full-page form (no sidebar/header)
- Organized into 5 sections:
  1. Personal Details (Name, Father's Name, CNIC, NTN, Passport)
  2. Address Information (Residential, Mailing, City, Province, Postal Code)
  3. Contact Information (Mobile, Landline, Email)
  4. Professional Information (Profession, Employer details)
  5. FBR Registration Details (FBR Registration Number, Tax Circle, Zone)

**Validation**:
- Required fields marked with red asterisk (*)
- CNIC: 13 digits (format: XXXXXXXXXXXXX or XXXXX-XXXXXXX-X)
- NTN: 7 digits
- Mobile: Pakistani format (03XXXXXXXXX)
- Email: Standard email validation

**Convenience Features**:
- "Copy from Residential" button for mailing address
- Pre-filled name and email from user registration
- Province dropdown with all Pakistani provinces
- Default country set to "Pakistan"

### Routing
**Route**: `/personal-info`

Added to `App.js` as a protected route (no layout/sidebar).

### Authentication Flow
1. User logs in via `/login`
2. Login response includes `hasPersonalInfo` flag
3. If `hasPersonalInfo === false` and user is not admin:
   - Redirect to `/personal-info`
   - Show toast: "Please complete your personal information"
4. If `hasPersonalInfo === true` or user is admin:
   - Redirect to `/dashboard`

**File**: `Frontend/src/contexts/AuthContext.js` (updated login function)

## User Flow

### First-Time User
```
Login → Personal Info Form → Dashboard
```

### Returning User (Personal Info Already Completed)
```
Login → Dashboard
```

### Admin User
```
Login → Admin Dashboard (skips personal info entirely)
```

## Installation & Setup

### 1. Database Migration
Run the SQL migration to create the table:

```bash
# If using PostgreSQL directly
psql -U postgres -d tax_advisor -f database/create-personal-information-table.sql

# If using Docker
docker exec -i tax_advisor_db psql -U postgres -d tax_advisor < database/create-personal-information-table.sql
```

### 2. Backend
The route is already registered in `backend/src/app.js`:
```javascript
app.use('/api/personal-info', personalInfoRoutes);
```

No additional configuration needed.

### 3. Frontend
Component and routing are already set up in:
- `Frontend/src/components/PersonalInfo/PersonalInfoForm.js`
- `Frontend/src/App.js`
- `Frontend/src/contexts/AuthContext.js`

## Testing

### Test Scenario 1: New User
1. Register a new user account
2. Login with new user credentials
3. Should be redirected to `/personal-info`
4. Fill and submit the form
5. Should be redirected to `/dashboard`
6. Logout and login again
7. Should go directly to `/dashboard` (skip personal info)

### Test Scenario 2: Existing User
1. Login with existing user who has NOT completed personal info
2. Should be redirected to `/personal-info`
3. Complete the form
4. Logout and login again
5. Should go directly to `/dashboard`

### Test Scenario 3: Admin User
1. Login as admin (khurramj@taxadvisor.pk)
2. Should go directly to `/admin` dashboard
3. Should never see personal info form

### Test Scenario 4: Form Validation
1. Try to submit form with empty required fields
2. Should show validation errors
3. Try invalid CNIC (not 13 digits)
4. Try invalid NTN (not 7 digits)
5. Try invalid mobile number
6. Should show appropriate error messages

## API Testing

### Check Personal Info Exists
```bash
curl -X GET http://localhost:3001/api/personal-info/2025-26 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Create Personal Info
```bash
curl -X POST http://localhost:3001/api/personal-info/2025-26 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Test User",
    "father_name": "Father Name",
    "cnic": "1234567890123",
    "ntn": "1234567",
    "residential_address": "Test Address",
    "city": "Karachi",
    "province": "Sindh",
    "mobile_number": "03001234567",
    "email_address": "test@example.com"
  }'
```

## Security Considerations

1. **Authentication Required**: All API endpoints require valid JWT token
2. **User Isolation**: Users can only access their own personal information
3. **HTTPS in Production**: Ensure all communication is encrypted in production
4. **Input Validation**: Both client-side and server-side validation
5. **SQL Injection Prevention**: Using parameterized queries
6. **XSS Prevention**: React automatically escapes user input

## Future Enhancements

1. **Edit Personal Info**: Allow users to edit their information from settings page
2. **Multi-Year Support**: Support different personal info for different tax years
3. **Document Upload**: Allow users to upload CNIC/NTN scans
4. **Bulk Import**: Admin feature to import user personal info from CSV/Excel
5. **Audit Trail**: Track when personal info was created/modified
6. **Email Verification**: Verify email address before allowing tax filing
7. **SMS Verification**: Verify mobile number via OTP

## Troubleshooting

### Issue: Form keeps appearing even after submission
**Solution**: Check that the database insert was successful. Query the database:
```sql
SELECT * FROM personal_information WHERE user_id = 'YOUR_USER_ID';
```

### Issue: Login doesn't redirect to personal info form
**Solution**: Check browser console for `hasPersonalInfo` value in login response.

### Issue: API returns 401 Unauthorized
**Solution**: Check that JWT token is being sent in Authorization header.

### Issue: Database foreign key constraint error
**Solution**: Ensure the users table exists and the user_id being inserted exists in users table.

## Files Changed/Created

### Created
- `Frontend/src/components/PersonalInfo/PersonalInfoForm.js`
- `database/create-personal-information-table.sql`
- `PERSONAL_INFO_IMPLEMENTATION.md`

### Modified
- `Frontend/src/App.js` - Added personal info route
- `Frontend/src/contexts/AuthContext.js` - Updated login to check hasPersonalInfo
- `Frontend/src/components/Auth/Login.js` - Added redirect logic
- `backend/src/routes/auth.js` - Added hasPersonalInfo check in login endpoint

### Already Existed (No Changes Needed)
- `backend/src/routes/personalInfo.js` - Backend API routes
- `backend/src/app.js` - Route registration already present

## Compliance

This implementation captures all required fields as per FBR Income Tax Return forms:
- Personal identification (CNIC, NTN)
- Contact details (Mobile, Email, Address)
- Employment information (Employer name, NTN, Address)
- FBR registration details (Tax Circle, Zone)

All fields align with FBR Form requirements for individual taxpayers in Pakistan.
