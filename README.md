# simple-serverless-architecture

<img src="https://github.com/BurakDeniz01/simple-serverless-architecture/raw/main/simple-serverless-architecture.png" width="532">

This is basic lambda function to call remote API, to write and read DynamoDB.

## Requirements

- create AWS Account
- create API Gateway in AWS
- create Lambda in AWS
- create DynamoDB in AWS
- create CloudWatch in AWS
- give permission to Lambda for DynamoDB and CloudWatch(If you use, add S3 bucket permission) by IAM in AWS

## Usage

Before beginning:
- Make sure to define environment variables in Lambda.
- Edit Lambda timeout to 30 seconds. When lambda created, default is 3 seconds.(API gateway timeout maximum is 29 seconds)

### Healthcheck endpoint

With `url/healthcheck` you can check if the lambda is alive. 

If status of response is 200, Lambda is alive.

Ex:
`https://your_unique_aws_api_gateway_url/healthcheck`

### Coin list endpoint

With `url/coins/list` you can get all list of coins. 

If status of response is 200, body of response has list of coins. 
If status of response is 504, API gateway timeout. 
If status of response is 404, your path after your_unique_aws_api_gateway_url is wrong.
If status of response is 500, something go wrong. Please check cloudWatch

Ex:
`https://your_unique_aws_api_gateway_url/coins/list`
