import React from 'react';
import FileUpload from './components/FileUpload';

function App() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial' }}>
      <h1>Smart Expense Tracker</h1>
      <FileUpload />
    </div>
  );
}

export default App;