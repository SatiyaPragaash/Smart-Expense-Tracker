const fs = require('fs');
const path = require('path');

function checkBudgets(budgetOverrides = null) {
  const expenses = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'test', 'categorized_expenses.json'))
  );
  const budgets = budgetOverrides
    || JSON.parse(fs.readFileSync(path.join(__dirname, 'utils', 'budgetConfig.json')));

  const totals = {};
  for (const tx of expenses) {
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
