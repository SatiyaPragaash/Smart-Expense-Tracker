import React, { useState } from 'react';
import '../App.css';

function FileUpload() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState(null);

  const [budgets, setBudgets] = useState({
    Groceries: 200,
    Transport: 100,
    Dining: 150,
    Entertainment: 80,
    Utilities: 120,
  });

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMessage('');
    setSummary(null);
  };

  const handleBudgetChange = (category, value) => {
    setBudgets(prev => ({
      ...prev,
      [category]: Number(value),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setMessage('Please select a JSON file.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('budgets', JSON.stringify(budgets));

    try {
      const response = await fetch('http://localhost:3001/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setMessage(data.message);
        setSummary(data.budgetSummary);
      } else {
        setMessage('❌ Upload failed. Check backend.');
        setSummary(null);
      }
    } catch (err) {
      console.error(err);
      setMessage('❌ Network or server error.');
      setSummary(null);
    }
  };

  return (
    <div className="container animate-fade-in">
      <h1>💰 Smart Expense Tracker</h1>
      
      <form onSubmit={handleSubmit}>
        <div className="budget-input-section">
          <h3>💳 Set Your Monthly Budgets</h3>
          {Object.entries(budgets).map(([cat, val]) => (
            <div key={cat} className="budget-item">
              <label className="budget-label">
                {cat === 'Groceries' && '🛒'} 
                {cat === 'Transport' && '🚗'} 
                {cat === 'Dining' && '🍽️'} 
                {cat === 'Entertainment' && '🎬'} 
                {cat === 'Utilities' && '💡'} 
                {cat}:
              </label>
              <input
                type="number"
                value={val}
                onChange={(e) => handleBudgetChange(cat, e.target.value)}
                className="budget-input"
                min="0"
                step="10"
              />
            </div>
          ))}
        </div>

        <div className="upload-section">
          <input 
            type="file" 
            accept=".json" 
            onChange={handleFileChange}
            style={{ flex: 1 }}
          />
          <button type="submit">📤 Upload & Analyze</button>
        </div>
      </form>

      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {summary && (
        <div className="budget-summary">
          <h3>📊 Budget Analysis</h3>
          <ul>
            {summary.map((item, idx) => (
              <li key={idx} className={item.over ? 'over' : ''}>
                <span className="category-name">
                  {item.category === 'Groceries' && '🛒'} 
                  {item.category === 'Transport' && '🚗'} 
                  {item.category === 'Dining' && '🍽️'} 
                  {item.category === 'Entertainment' && '🎬'} 
                  {item.category === 'Utilities' && '💡'} 
                  {item.category}
                </span>
                <span className="budget-amount">${item.spent} / ${item.limit}</span>
                {item.over && <span className="over-budget-indicator">🚨</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default FileUpload;