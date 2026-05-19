import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App';

// Google OAuth client ID for the web. Set REACT_APP_GOOGLE_OAUTH_CLIENT_ID
// in your .env (or via the build pipeline). When empty, the GoogleLogin
// button still renders but reports a config error on click — keeps dev
// environments without Google credentials usable.
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_OAUTH_CLIENT_ID || '';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
