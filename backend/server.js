const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const processExpenses = require('./expenseProcessor');
const checkBudgets = require('./budgetChecker');

const app = express();
const port = 3001;

// Enable CORS
app.use(cors());

// Multer setup to store uploaded JSON file
const upload = multer({
  dest: path.join(__dirname, '../data/uploaded'),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed!'), false);
    }
  }
});

// POST /upload
app.post('/upload', upload.single('file'), (req, res) => {
  const uploadedFilePath = req.file?.path;

  try {
    // Get optional budgets JSON from form-data
    const budgetConfig = req.body.budgets
      ? JSON.parse(req.body.budgets)
      : null;

    // Process file
    const categorized = processExpenses(uploadedFilePath);

    // Run budget check using provided budgets or fallback to default
    const budgetResult = checkBudgets(budgetConfig);

    res.status(200).json({
      message: '✅ File processed.',
      budgetSummary: budgetResult
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '❌ Error processing file.' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Backend running at http://localhost:${port}`);
});
