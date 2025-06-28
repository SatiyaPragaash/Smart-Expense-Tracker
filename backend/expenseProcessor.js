const path = require('path');
const categorizeTransaction = require('./utils/categorize');

function processExpenses(transactions) {
    return transactions.map(tx => ({
      ...tx,
      category: categorizeTransaction(tx.merchant)
    }));
  }
  
module.exports = processExpenses;
