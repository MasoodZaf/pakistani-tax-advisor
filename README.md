# 🇵🇰 Pakistani Tax Advisor - Production Ready

A comprehensive tax calculation and filing system for Pakistani taxpayers, designed for tax consultants and individuals.

## 🚀 Quick Start for Tax Consultants

### Option 1: One-Click Setup (Recommended)
```bash
# Clone the repository
git clone https://github.com/MasoodZaf/pakistani-tax-advisor.git
cd pakistani-tax-advisor

# Run the automated setup
chmod +x setup.sh
./setup.sh
```

**Access URLs:**
- **Main Application**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin
- **API**: http://localhost:3001

### 👥 Ready-to-Use Admin Accounts

**Super Admin** (Full Access + User Impersonation):
- **Email**: `superadmin@paktaxadvisor.com`
- **Password**: `admin123`

**Regular Admin**:
- **Email**: `admin@test.com`
- **Password**: `admin123`

## ✨ Key Features for Tax Consultants

### 🔐 Admin Panel Features
- **👤 User Impersonation**: Auto-logout and login as any user to assist with tax filing
- **📊 User Management**: Complete user account management and monitoring
- **🧮 Tax Calculator**: Built-in Pakistani tax calculator (2025-26 tax slabs)
- **📈 Reports & Analytics**: Comprehensive tax reports and user statistics
- **⚙️ System Management**: Database management and health monitoring

### 💼 Tax Filing System
- **📋 Complete Tax Forms**: All Pakistani tax form components
- **💰 Auto Tax Calculation**: Real-time calculation based on Pakistani tax laws
- **✅ Form Validation**: Real-time validation and error checking
- **📊 Progress Tracking**: Visual progress tracking for tax form completion
- **📤 Data Export**: Export tax data and generate reports

## Tech Stack

### Frontend
- React.js
- Material-UI
- Tailwind CSS
- Formik & Yup for form management
- Axios for API communication
- React Router for navigation
- Context API for state management

### Backend
- Node.js
- Express.js
- PostgreSQL database
- JWT for authentication
- bcrypt for password hashing
- Winston for logging

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn package manager

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/pakistani-tax-advisor.git
   cd pakistani-tax-advisor
   ```

2. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```

3. Install frontend dependencies:
   ```bash
   cd ../Frontend
   npm install
   ```

4. Create and configure environment variables:
   
   Backend (.env):
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=tax_advisor
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   ```

5. Initialize the database (Prisma baseline + phase migrations):
   ```bash
   cd backend
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/migrations/0_init/migration.sql
   for f in $(ls database/migrations/phase-*.sql | sort); do
     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
   done
   ```
   Note: the root-level `schema.legacy.sql` is kept for historical reference
   only — do not use it to bootstrap a new database.

6. Start the development servers:

   Backend:
   ```bash
   cd backend
   npm start
   ```

   Frontend:
   ```bash
   cd Frontend
   npm start
   ```

## Project Structure

```
tax-advisor/
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   ├── tests/
│   └── package.json
├── Frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── services/
│   │   ├── styles/
│   │   └── utils/
│   ├── public/
│   └── package.json
├── database/
│   ├── schema.sql
│   └── migrations/
└── README.md
```

## API Documentation

### Authentication Endpoints
- POST `/api/register` - User registration
- POST `/api/login` - User login

### Tax Form Endpoints
- GET `/api/tax-years` - Get available tax years
- GET `/api/employers` - Get employer list
- PUT `/api/forms/income/:taxYear` - Update income form
- GET `/api/forms/completion-status/:taxYearId` - Get form completion status

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Pakistani tax laws and regulations
- Material-UI components library
- Tailwind CSS utility framework 