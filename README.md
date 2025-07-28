# Pakistani Tax Advisor

A comprehensive tax calculation and management system for Pakistani taxpayers. This application helps users manage their tax returns across multiple years, with features for income declaration, tax calculation, and wealth statement management.

## Features

- Multi-year tax return management
- Comprehensive tax forms:
  - Income declaration
  - Adjustable tax
  - Tax reductions
  - Tax credits
  - Deductions
  - Final tax
  - Capital gains
  - Expenses tracking
  - Wealth statement
- Automatic tax calculation based on latest tax slabs
- Real-time tax calculation and updates
- Professional UI with Pakistani theme colors
- Role-based access control (Admin/User)
- Secure authentication and session management
- Audit logging for all changes

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

5. Initialize the database:
   ```bash
   psql -U your_db_user -d tax_advisor -f schema.sql
   ```

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