import React, { useState } from 'react';
import axios from 'axios';

const LoginDebug = () => {
  const [logs, setLogs] = useState([]);
  const [email, setEmail] = useState('testuser@paktaxadvisor.com');
  const [password, setPassword] = useState('TestUser123');

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const clearLogs = () => setLogs([]);

  const testDirectLogin = async () => {
    clearLogs();
    addLog('=== TESTING DIRECT API CALL ===');
    
    try {
      addLog(`Testing login for: ${email}`);
      
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      addLog(`Response status: ${response.status}`);
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        addLog('✅ Direct API call SUCCESS', 'success');
        addLog(`User: ${data.user.name} (${data.user.role})`);
        addLog(`Session Token: ${data.sessionToken.substring(0, 12)}...`);
        
        // Store token in localStorage
        localStorage.setItem('token', data.sessionToken);
        addLog('Token stored in localStorage');
        
        // Test session verification
        await testSessionVerification(data.sessionToken);
        
      } else {
        addLog(`❌ Direct API call FAILED: ${data.error}`, 'error');
      }
      
    } catch (error) {
      addLog(`❌ Network error: ${error.message}`, 'error');
    }
  };

  const testAxiosLogin = async () => {
    addLog('\\n=== TESTING AXIOS CALL ===');
    
    try {
      const response = await axios.post('/api/login', {
        email,
        password
      });

      addLog('✅ Axios call SUCCESS', 'success');
      addLog(`User: ${response.data.user.name}`);
      addLog(`Session Token: ${response.data.sessionToken.substring(0, 12)}...`);
      
    } catch (error) {
      addLog(`❌ Axios call FAILED: ${error.response?.data?.error || error.message}`, 'error');
      addLog(`Status: ${error.response?.status}`);
    }
  };

  const testSessionVerification = async (token) => {
    addLog('\\n=== TESTING SESSION VERIFICATION ===');
    
    try {
      const response = await fetch('/api/verify-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionToken: token })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        addLog('✅ Session verification SUCCESS', 'success');
        addLog(`Verified user: ${data.user.name}`);
      } else {
        addLog(`❌ Session verification FAILED: ${data.error}`, 'error');
      }
      
    } catch (error) {
      addLog(`❌ Session verification error: ${error.message}`, 'error');
    }
  };

  const checkLocalStorage = () => {
    addLog('\\n=== CHECKING LOCALSTORAGE ===');
    const token = localStorage.getItem('token');
    if (token) {
      addLog(`Token found: ${token.substring(0, 12)}...`);
      testSessionVerification(token);
    } else {
      addLog('No token in localStorage');
    }
  };

  const clearLocalStorage = () => {
    localStorage.clear();
    addLog('localStorage cleared');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>Login Debug Console</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label>Email: </label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '300px', padding: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>Password: </label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '300px', padding: '5px' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={testDirectLogin} style={{ margin: '5px', padding: '8px 12px' }}>
          Test Direct API
        </button>
        <button onClick={testAxiosLogin} style={{ margin: '5px', padding: '8px 12px' }}>
          Test Axios
        </button>
        <button onClick={checkLocalStorage} style={{ margin: '5px', padding: '8px 12px' }}>
          Check LocalStorage
        </button>
        <button onClick={clearLocalStorage} style={{ margin: '5px', padding: '8px 12px' }}>
          Clear LocalStorage
        </button>
        <button onClick={clearLogs} style={{ margin: '5px', padding: '8px 12px' }}>
          Clear Logs
        </button>
      </div>

      <div style={{ 
        border: '1px solid #ccc', 
        padding: '10px', 
        height: '400px', 
        overflow: 'auto',
        backgroundColor: '#f5f5f5',
        whiteSpace: 'pre-wrap'
      }}>
        {logs.map((log, index) => (
          <div key={index} style={{ 
            color: log.type === 'error' ? 'red' : log.type === 'success' ? 'green' : 'black',
            marginBottom: '2px'
          }}>
            [{log.timestamp}] {log.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoginDebug;