import React from 'react';
import TaxInputForm from './components/TaxInputForm';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>🇵🇰 Pakistani Tax Advisor</h1>
        <p>Calculate your income tax for Pakistan 2024-25</p>
      </header>
      <main>
        <TaxInputForm />
      </main>
    </div>
  );
}

export default App; 