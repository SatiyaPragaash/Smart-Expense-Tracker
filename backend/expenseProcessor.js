const fs = require('fs');
const path = require('path');
const categorizeTransaction = require('./utils/categorize');

function processExpenses(inputFilePath) {
  const rawData = fs.readFileSync(inputFilePath);
  const transactions = JSON.parse(rawData);

  const categorized = transactions.map(tx => ({
    ...tx,
    category: categorizeTransaction(tx.merchant)
  }));

  // Save raw copy
  const rawFilename = path.basename(inputFilePath);
  fs.copyFileSync(inputFilePath, path.join(__dirname, '../data/uploaded', rawFilename));

  // Save processed output
  const outputPath = path.join(__dirname, 'test', 'categorized_expenses.json');
  fs.writeFileSync(outputPath, JSON.stringify(categorized, null, 2));

  console.log("✅ Transactions processed and categorized.");
}

module.exports = processExpenses;
