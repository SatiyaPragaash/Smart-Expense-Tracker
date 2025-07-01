const AWS = require('aws-sdk');
const PDFDocument = require('pdfkit');
const stream = require('stream');
const processExpenses = require('./expenseProcessor');
const checkBudgets = require('./budgetChecker');

const s3 = new AWS.S3();
const dynamo = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

const TABLE_NAME = process.env.DYNAMO_TABLE;
const BUCKET_NAME = process.env.S3_BUCKET;
const SNS_TOPIC = process.env.ALERT_TOPIC;

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

    // Generate PDF
    const doc = new PDFDocument();
    const pdfBuffer = await new Promise((resolve, reject) => {
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.fontSize(18).text("📊 Expense Report", { underline: true });
      doc.moveDown();

      categorized.forEach(tx => {
        doc.fontSize(12).text(`• ${tx.date} | ${tx.merchant} | $${tx.amount.toFixed(2)} | ${tx.category}`);
      });

      doc.addPage().fontSize(16).text("🛑 Budget Summary", { underline: true });
      summary.forEach(s => {
        doc.fontSize(12).text(`${s.category}: $${s.spent} / $${s.limit} ${s.over ? '🚨 OVER' : ''}`);
      });

      doc.end();
    });

    const pdfKey = `expenses/reports/report-${Date.now()}.pdf`;

    // Upload to S3
    await s3.putObject({
      Bucket: BUCKET_NAME,
      Key: pdfKey,
      Body: pdfBuffer,
      ContentType: 'application/pdf'
    }).promise();

    console.log("✅ PDF uploaded to S3:", pdfKey);

    // Check for over budget and send SNS alert
    const overage = summary.filter(item => item.over);
    if (overage.length > 0) {
      const presignedUrl = s3.getSignedUrl('getObject', {
        Bucket: BUCKET_NAME,
        Key: pdfKey,
        Expires: 60 * 60 // 1 hour
      });

      const alertMsg = `🚨 Budget Alert!\nThe following categories are over budget:\n${overage.map(c => `${c.category}: $${c.spent} / $${c.limit}`).join("\n")}\n\nDownload Full Report: ${presignedUrl}`;

      await sns.publish({
        TopicArn: SNS_TOPIC,
        Message: alertMsg,
        Subject: "🚨 Budget Overage Detected"
      }).promise();

      console.log("📬 SNS alert sent");
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "✅ File processed and stored.",
        budgetSummary: summary,
        reportUrl: `https://${BUCKET_NAME}.s3.amazonaws.com/${pdfKey}`
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
