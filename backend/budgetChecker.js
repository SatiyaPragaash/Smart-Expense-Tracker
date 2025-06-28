const path = require('path');

function checkBudgets(transactions, budgetOverrides = null) {
    const defaultBudgets = {
      Groceries: 200,
      Transport: 100,
      Dining: 150,
      Entertainment: 80,
      Utilities: 120
    };
  
    const budgets = budgetOverrides || defaultBudgets;
  
    const totals = {};
    for (const tx of transactions) {
      if (!totals[tx.category]) totals[tx.category] = 0;
      totals[tx.category] += tx.amount;
    }
  
    const summary = [];
    for (const category in budgets) {
      const spent = totals[category] || 0;
      const limit = budgets[category];
      const over = spent > limit;
      summary.push({
        category,
        spent: spent.toFixed(2),
        limit,
        over
      });
    }
  
    return summary;
  }
  
  module.exports = checkBudgets;
  