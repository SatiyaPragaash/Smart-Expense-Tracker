const path = require('path');
const processExpenses = require('../expenseProcessor');
const checkBudgets = require('../budgetChecker');

const inputPath = path.join(__dirname, 'sample-transactions.json');

console.log("🚀 Running Expense Processing...");
processExpenses(inputPath);

console.log("\n🚦 Running Budget Check...");
checkBudgets();
