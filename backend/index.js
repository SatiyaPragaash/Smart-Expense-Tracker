const AWS = require('aws-sdk');
const processExpenses = require('./expenseProcessor');
const checkBudgets = require('./budgetChecker');

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.DYNAMO_TABLE;

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);

    const transactions = body.expenses;
    const budgets = body.budgets;

    if (!transactions || !Array.isArray(transactions)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing or invalid 'transactions' array." })
      };
    }

    const categorized = processExpenses(transactions);
    const summary = checkBudgets(categorized, budgets);

    // Store each transaction in DynamoDB
    const putPromises = categorized.map((tx) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      return dynamo.put({
        TableName: TABLE_NAME,
        Item: {
          id,
          date: tx.date,
          merchant: tx.merchant,
          amount: tx.amount,
          category: tx.category
        }
      }).promise();
    });

    await Promise.all(putPromises);
    console.log(`✅ Stored ${categorized.length} transactions to DynamoDB`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "✅ File processed and stored.",
        budgetSummary: summary
      })
    };
  } catch (err) {
    console.error("❌ Lambda error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "❌ Error processing request." })
    };
  }
};
