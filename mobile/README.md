# 📱 Pakistani Tax Advisor — Mobile App

> **⚠️ PROTOTYPE — NOT PRODUCTION.**
> The mobile app is a **scaffold / work-in-progress**. It currently:
> - has no tax-calculation logic (the local calculator was deleted in April 2026
>   because the math was wrong — mobile must call the backend compute API,
>   which is not yet wired)
> - points at `http://localhost:3001` by default
> - has no automated tests and is not covered by CI
> - is **not** expected to produce correct tax numbers
>
> Do not distribute this build to end users. Treat the features listed below as
> *intended scope*, not implemented state. Use the web app for real filing.

A React Native mobile application for Pakistani taxpayers to manage their tax returns efficiently and comply with FBR regulations.

## 🌟 Features

### Core Functionality
- **📊 Dashboard** - Overview of tax year progress and quick actions
- **📝 Tax Forms** - Mobile-optimized income, deductions, and tax calculation forms
- **🧮 Tax Calculator** - Real-time tax calculation with Pakistani FBR rates
- **👤 User Authentication** - Secure login and registration
- **💾 Offline Support** - Forms work offline with data synchronization

### Admin Features (for Tax Consultants)
- **👥 User Management** - Manage client accounts
- **📈 Tax Analytics** - Client tax summaries and reports
- **✏️ Client Editing** - Edit client tax forms as qualified consultant
- **📊 Bulk Operations** - Handle multiple clients efficiently

### Mobile-Specific Features
- **📱 Responsive Design** - Optimized for all screen sizes
- **💾 Local Storage** - Form data saved locally for offline access
- **🔔 Push Notifications** - Tax deadline reminders
- **📄 Document Scanning** - Camera integration for receipt uploads
- **🔒 Biometric Auth** - Fingerprint/Face ID login

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Expo CLI
- Android Studio (for Android development)
- Xcode (for iOS development - macOS only)

### Installation

1. **Clone and navigate to mobile directory**
   ```bash
   cd mobile
   npm install
   ```

2. **Start the development server**
   ```bash
   npm start
   # or
   npx expo start
   ```

3. **Run on device/simulator**
   ```bash
   # Android
   npm run android
   
   # iOS (macOS only)
   npm run ios
   
   # Web browser
   npm run web
   ```

## 📱 Building for Production

### Android APK
```bash
# Install EAS CLI
npm install -g @expo/eas-cli

# Login to Expo
eas login

# Build Android APK
eas build --platform android --profile preview
```

### iOS IPA (requires Apple Developer account)
```bash
# Build iOS app
eas build --platform ios --profile production
```

### App Store Submission
```bash
# Submit to Google Play Store
eas submit --platform android

# Submit to Apple App Store
eas submit --platform ios
```

## 🏗️ Project Structure

```
mobile/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── Auth/          # Authentication components
│   │   ├── TaxForms/      # Tax form components
│   │   ├── Admin/         # Admin panel components
│   │   └── Common/        # Shared components
│   ├── screens/           # Screen components
│   │   ├── LoginScreen.js
│   │   ├── DashboardScreen.js
│   │   ├── TaxFormsScreen.js
│   │   └── ...
│   ├── navigation/        # Navigation configuration
│   │   └── AppNavigator.js
│   ├── contexts/          # React contexts
│   │   └── AuthContext.js
│   ├── services/          # API services
│   │   └── api.js
│   └── utils/             # Utility functions
│       ├── storage.js
│       └── taxCalculator.js
├── assets/                # Images, fonts, etc.
├── app.json              # Expo configuration
├── eas.json              # EAS Build configuration
└── package.json          # Dependencies
```

## 🔧 Configuration

### Environment Variables
Update `app.json` to configure API endpoints:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://your-api-server.com/api"
    }
  }
}
```

### App Icons and Splash Screen
- Place app icon in `assets/icon.png` (1024x1024)
- Place splash screen in `assets/splash-icon.png`
- Update `app.json` with your app details

## 📊 Tax Calculation Features

### Pakistani FBR Tax Rates 2025-26
- **0%** - Up to PKR 600,000
- **5%** - PKR 600,001 to PKR 1,200,000  
- **12.5%** - PKR 1,200,001 to PKR 2,200,000
- **20%** - PKR 2,200,001 to PKR 3,200,000
- **25%** - PKR 3,200,001 to PKR 4,100,000
- **35%** - Above PKR 4,100,000

### Supported Forms
- ✅ Income Information (Salary, Bonus, Allowances)
- ✅ Deductions & Allowances (Zakat, Donations, Medical)
- ✅ Final Tax Calculation & Review
- 🚧 Wealth Statement (Coming Soon)
- 🚧 Capital Gains (Coming Soon)

## 🔒 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Local Encryption** - Sensitive data encrypted in local storage
- **API Security** - All API calls secured with authentication headers
- **Biometric Auth** - Fingerprint/Face ID for app access
- **Auto-logout** - Automatic logout after inactivity

## 🌐 Offline Support

- **Form Data Caching** - Tax forms work offline
- **Queue Management** - API calls queued when offline
- **Auto-sync** - Data syncs when connection restored
- **Conflict Resolution** - Handles data conflicts gracefully

## 🧪 Testing

### Running Tests
```bash
npm test
```

### Manual Testing Checklist
- [ ] Login/Registration flow
- [ ] Tax form completion
- [ ] Offline functionality
- [ ] Push notifications
- [ ] Admin panel features
- [ ] Data synchronization

## 🚀 Deployment

### Play Store Requirements
- Signed APK/AAB
- Privacy Policy
- App screenshots
- Store listing details

### App Store Requirements  
- Signed IPA
- App Store Connect setup
- Privacy Policy
- App screenshots
- App Store review guidelines compliance

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- 📧 Email: support@paktaxadvisor.com
- 🐛 Issues: GitHub Issues
- 📖 Documentation: Wiki

## 🎯 Roadmap

### Version 1.1
- [ ] Document scanning with OCR
- [ ] Wealth statement form
- [ ] Capital gains calculator
- [ ] Push notifications

### Version 1.2
- [ ] Multi-language support (Urdu)
- [ ] Advanced reporting
- [ ] Tax planning tools
- [ ] Client portal for consultants

### Version 2.0
- [ ] AI-powered tax recommendations
- [ ] Integration with bank APIs
- [ ] Real-time FBR updates
- [ ] Advanced analytics dashboard

---

🇵🇰 **Made with ❤️ for Pakistani Taxpayers**

*Compliant with Federal Board of Revenue (FBR) Tax Laws 2025-26*