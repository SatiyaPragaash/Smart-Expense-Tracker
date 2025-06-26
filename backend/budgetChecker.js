const fs = require('fs');
const path = require('path');

function checkBudgets() {
  const expenses = JSON.parse(fs.readFileSync(path.join(__dirname, 'test', 'categorized_expenses.json')));
  const budgets = JSON.parse(fs.readFileSync(path.join(__dirname, 'utils', 'budgetConfig.json')));

  const totals = {};

  for (const tx of expenses) {
    if (!totals[tx.category]) totals[tx.category] = 0;
    totals[tx.category] += tx.amount;
  }

  console.log("📊 Budget Check Summary:");
  for (const category in budgets) {
    const spent = totals[category] || 0;
    const limit = budgets[category];
    console.log(`- ${category}: $${spent.toFixed(2)} spent (Limit: $${limit})`);
    if (spent > limit) {
      console.log(`🚨 ALERT: Budget exceeded in ${category} by $${(spent - limit).toFixed(2)}!`);
    }
  }
}

module.exports = checkBudgets;
