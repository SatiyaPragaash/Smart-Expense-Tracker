import React, { useState } from 'react';

function FileUpload() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState(null); // New state to hold budget summary

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMessage('');
    setSummary(null); // Reset summary on new file
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setMessage('Please select a JSON file.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:3001/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setMessage(data.message);
        setSummary(data.budgetSummary); // Store the budget summary
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
    <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
      <input type="file" accept=".json" onChange={handleFileChange} />
      <button type="submit" style={{ marginLeft: '1rem' }}>Upload</button>

      <div style={{ marginTop: '1rem', color: message.includes('✅') ? 'green' : 'red' }}>
        {message}
      </div>

      {summary && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Budget Summary</h3>
          <ul>
            {summary.map((item, idx) => (
              <li key={idx}>
                {item.category}: ${item.spent} / ${item.limit}
                {item.over && <span style={{ color: 'red' }}> 🚨 Over Budget!</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

export default FileUpload;
