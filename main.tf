provider "aws" {
  region = "us-east-1"
}

resource "random_id" "suffix" {
  byte_length = 4
}

# -------------------- S3 Buckets --------------------
resource "aws_s3_bucket" "uploads" {
  bucket        = "smart-expense-tracker-uploads-${random_id.suffix.hex}"
  force_destroy = true
  tags = { Name = "Expense Uploads", Environment = "Dev" }
}

resource "aws_s3_bucket" "frontend" {
  bucket        = "smart-expense-tracker-frontend-${random_id.suffix.hex}"
  force_destroy = true
  tags = { Name = "Frontend Hosting", Environment = "Dev" }
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  index_document { suffix = "index.html" }
  error_document { key = "index.html" }
}

resource "aws_s3_bucket_public_access_block" "frontend_block" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "frontend_public_policy" {
  bucket = aws_s3_bucket.frontend.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Sid       = "PublicReadGetObject",
      Effect    = "Allow",
      Principal = "*",
      Action    = ["s3:GetObject"],
      Resource  = "${aws_s3_bucket.frontend.arn}/*"
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.frontend_block]
}

# -------------------- DynamoDB --------------------
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

# -------------------- SNS Topic --------------------
resource "aws_sns_topic" "budget_alerts" {
  name = "budget-overage-alerts"
}

resource "aws_sns_topic_subscription" "email_sub" {
  topic_arn = aws_sns_topic.budget_alerts.arn
  protocol  = "email"
  endpoint  = "satiya.prm@gmail.com"
}

# -------------------- Lambda Role & Function --------------------
resource "aws_iam_role" "lambda_exec_role" {
  name = "lambda_execution_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action    = "sts:AssumeRole",
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" }
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
        Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
        Effect = "Allow",
        Resource = "*"
      },
      {
        Action = ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
        Effect = "Allow",
        Resource = [
          aws_s3_bucket.uploads.arn,
          "${aws_s3_bucket.uploads.arn}/*"
        ]
      },
      {
        Action = ["dynamodb:PutItem"],
        Effect = "Allow",
        Resource = aws_dynamodb_table.transactions.arn
      },
      {
        Action = ["sns:Publish"],
        Effect = "Allow",
        Resource = aws_sns_topic.budget_alerts.arn
      }
    ]
  })
}

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
      ALERT_TOPIC   = aws_sns_topic.budget_alerts.arn
      REPORT_BUCKET = aws_s3_bucket.uploads.bucket
    }
  }
}

# -------------------- API Gateway --------------------
resource "aws_apigatewayv2_api" "api" {
  name          = "expense-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["*"]
  }
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

# -------------------- CloudFront + WAF --------------------
resource "aws_wafv2_web_acl" "frontend_acl" {
  name        = "frontend-acl"
  description = "WAF for Smart Expense Frontend"
  scope       = "CLOUDFRONT"
  default_action {
    allow {}
  }
  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "frontendACL"
    sampled_requests_enabled   = true
  }
  rule {
    name     = "AWS-AWSManagedRulesCommonRuleSet"
    priority = 1
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "commonRule"
    }
  }
}

resource "aws_cloudfront_distribution" "frontend_cdn" {
  enabled             = true
  default_root_object = "index.html"

  origin {
    domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id   = "s3-frontend-origin"
    s3_origin_config {
      origin_access_identity = ""
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3-frontend-origin"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  web_acl_id = aws_wafv2_web_acl.frontend_acl.arn
}

# -------------------- Generate config.json --------------------
resource "local_file" "frontend_config" {
  filename = "${path.module}/frontend-config.json"
  content  = jsonencode({
    API_URL = "${aws_apigatewayv2_api.api.api_endpoint}/prod/upload"
  })
}

# -------------------- Unzip & Upload frontend.zip --------------------
resource "null_resource" "upload_frontend_assets" {
  depends_on = [local_file.frontend_config]

  provisioner "local-exec" {
    command = <<EOT
      rm -rf tmp_frontend
      mkdir -p tmp_frontend
      unzip -q frontend.zip -d tmp_frontend
      cp "${path.module}/frontend-config.json" tmp_frontend/config.json
      aws s3 sync tmp_frontend s3://${aws_s3_bucket.frontend.bucket} --delete
      rm -rf tmp_frontend
    EOT
  }
}

# -------------------- Outputs --------------------
output "api_endpoint" {
  value = "${aws_apigatewayv2_api.api.api_endpoint}/upload"
}

output "s3_frontend_url" {
  value = "http://${aws_s3_bucket.frontend.bucket}.s3-website.us-east-1.amazonaws.com"
}

output "cloudfront_url" {
  value = "https://${aws_cloudfront_distribution.frontend_cdn.domain_name}"
}

output "s3_bucket_name_uploads" {
  value = aws_s3_bucket.uploads.bucket
}

output "dynamo_table_name" {
  value = aws_dynamodb_table.transactions.name
}