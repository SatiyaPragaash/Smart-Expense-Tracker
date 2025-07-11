import React, { useState, useEffect } from 'react';
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

  const [apiUrl, setApiUrl] = useState('');

  useEffect(() => {
    fetch('/config.json')
      .then(res => res.json())
      .then(config => {
        setApiUrl(config.API_URL);
      })
      .catch(() => {
        setMessage('❌ Failed to load API config.');
      });
  }, []);

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

    try {
      const fileText = await file.text(); // Read file content
      const expenseData = JSON.parse(fileText); // Parse JSON

      const payload = {
        expenses: expenseData,
        budgets: budgets
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
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
      setMessage('❌ Invalid file format or server error.');
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
