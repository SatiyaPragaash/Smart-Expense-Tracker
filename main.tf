provider "aws" {
  region = "us-east-1"
}

resource "random_id" "suffix" {
  byte_length = 4
}

# -------------------- S3 BUCKET --------------------
resource "aws_s3_bucket" "uploads" {
  bucket = "smart-expense-tracker-uploads-${random_id.suffix.hex}"

  tags = {
    Name = "Expense Uploads"
    Environment = "Dev"
  }

  lifecycle {
    prevent_destroy = false
  }

  force_destroy = true
}

# -------------------- DYNAMODB TABLE --------------------
resource "aws_dynamodb_table" "transactions" {
  name         = "TransactionsTable"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Name = "Transactions Table"
    Environment = "Dev"
  }
}

# -------------------- IAM ROLE --------------------
resource "aws_iam_role" "lambda_exec_role" {
  name = "lambda_execution_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action = "sts:AssumeRole",
      Effect = "Allow",
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "lambda-inline-policy"
  role = aws_iam_role.lambda_exec_role.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Effect = "Allow",
        Resource = "*"
      },
      {
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket"
        ],
        Effect = "Allow",
        Resource = [
          aws_s3_bucket.uploads.arn,
          "${aws_s3_bucket.uploads.arn}/*"
        ]
      },
      {
        Action = [
          "dynamodb:PutItem"
        ],
        Effect = "Allow",
        Resource = aws_dynamodb_table.transactions.arn
      }
    ]
  })
}

# -------------------- LAMBDA FUNCTION --------------------
resource "aws_lambda_function" "upload_expense_lambda" {
  function_name    = "uploadExpenseHandler"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "index.handler"
  runtime          = "nodejs16.x"
  filename         = "${path.module}/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda.zip")
  timeout          = 30

  environment {
    variables = {
      S3_BUCKET     = aws_s3_bucket.uploads.bucket
      DYNAMO_TABLE  = aws_dynamodb_table.transactions.name
    }
  }
}

# -------------------- API GATEWAY --------------------
resource "aws_apigatewayv2_api" "api" {
  name          = "expense-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.upload_expense_lambda.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "upload_route" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /upload"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_apigatewayv2_stage" "default_stage" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "prod"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw_lambda" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.upload_expense_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# -------------------- OUTPUTS --------------------
output "api_endpoint" {
  value = "${aws_apigatewayv2_api.api.api_endpoint}/upload"
}

output "s3_bucket_name" {
  value = aws_s3_bucket.uploads.bucket
}

output "dynamo_table_name" {
  value = aws_dynamodb_table.transactions.name
}
