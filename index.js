const AWS = require("aws-sdk");
const https = require("https");
const dynamodb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });
const healthPath = "/healthcheck";
const coinsPath = "/coins/list";
const dynamodbTableName = process.env.DYNAMODB_COIN_TABLE_NAME; // Dynamodb table name
const bucket = process.env.AWS_S3_BUCKET_NAME_COIN; // S3 bucket name
const fileName = process.env.AWS_S3_COIN_BUCKET_PATH; // S3 file path
const coingeckoCoinListURL = process.env.COINGECKO_COIN_LIST_URL; // Coingecko url

exports.handler = async function (event) {
    console.log("Request event: ", event); // Log event
    let response;
    switch (true) {
        case event.httpMethod === "GET" && event.path === healthPath: // Check for healthcheck of getCoins lambda
            response = buildResponse(200);
            break;
        case event.httpMethod === "GET" && event.path === coinsPath:  // Get coins
            response = await getCoins(event);
            break;
        default:
            response = buildResponse(404, "404 Not Found");
    }
    return response;
}

async function getCoins() {
    return getCoinsListFromCG().then(async (CGCoins) => {
        let resultOfWrite = await writeDynamoRecords(CGCoins);
        if (resultOfWrite === "error") return buildResponse(500, { error: "Internal server error" });
        // If you want to scan dynamo records, uncomment this lines
        /*  
        let params = {
              TableName: dynamodbTableName
          }
          let DBCoins = await scanDynamoRecords(params, []);
          */
        let body = {
            coins: CGCoins
        }
        return buildResponse(200, body);
    }).catch((error) => {
        console.error(error) // an error occurred
        return buildResponse(500, { error: "Internal server error" });
    });
}

// Get the latest coin list from the remote API
function getCoinsListFromCG() {
    let url = coingeckoCoinListURL;
    return new Promise((resolve, reject) => {
        let req = https.get(url, res => {
            let rawData = "";
            res.on("data", chunk => {
                rawData += chunk;
            });
            res.on("end", () => {
                try {
                    resolve(JSON.parse(rawData));
                } catch (error) {
                    reject(new Error(error));
                }
            });
        });
        req.on("error", error => {
            reject(new Error(error));
        });
    });
}

async function writeDynamoRecords(coinsList) {
    try {
        // Edit data for dynamodb syntax
        let dynamodbItems = coinsList.map((x) => {
            return {
                PutRequest: {
                    Item: {
                        id: { "S": x.id },
                        name: { "S": x.name },
                        symbol: { "S": x.symbol }
                    }
                }
            }
        }
        );

        // These comment lines can be used if a different method is desired to be recorded in the table in the database.
        // await putObjectToS3(coinsList);
        // await importDynamoDB();

        // Capacity of batchWriteItem function is max. 25 item. This loop write dynamodb batch by batch
        for (let index = 0; index < dynamodbItems.length; index += 25) {
            let params = {
                RequestItems: {
                    [dynamodbTableName]: dynamodbItems.slice(index, index + 25)
                }
            };
            await dynamodb.batchWriteItem(params).promise();;
        }
        return "done"
    } catch (error) {
        console.error(error);  // an error occurred
        return "error";
    }
}
// Build response functions
function buildResponse(statusCode, body) {
    return {
        statusCode: statusCode,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    }
}

// write data on S3 bucket
async function putObjectToS3(data) {
    var s3 = new AWS.S3();
    var params = {
        Bucket: bucket,
        Key: fileName,
        Body: JSON.stringify(data)
    }
    await s3.putObject(params, function (error, data) {
        if (error) console.error("Something go wrong on S3", error, error.stack); // an error occurred
        else console.log("S3 file wrote");           // successful log
    });
}
// import data from S3 bucket to DynamoDB
async function importDynamoDB() {
    var params = {
        InputFormat: "DYNAMODB_JSON", // Data type on S3 bucket
        S3BucketSource: {
            S3Bucket: bucket, // Bucket Name
            S3KeyPrefix: fileName // File path in bucket
        },
        TableCreationParameters: {
            AttributeDefinitions: [
                // Attribute names and types
                {
                    AttributeName: "id",
                    AttributeType: "S"
                },
                {
                    AttributeName: "name",
                    AttributeType: "S"
                },
                {
                    AttributeName: "symbol",
                    AttributeType: "S"
                },
            ],
            KeySchema: [
                // Partition key of attributes
                {
                    AttributeName: "id",
                    KeyType: "HASH"
                },
            ],
            TableName: dynamodbTableName, //Name of table
            BillingMode: "PROVISIONED",
            ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1,
            },
        },
        InputCompressionType: "NONE",
    };
    // 
    dynamodb.importTable(params
        , function (error, data) {
            if (error) console.error("Something go wrong during to import dynamodb from s3", error, error.stack); // an error occurred
            else console.log("imported dynamodb from s3", data);           // successful log
        }

    );
}
// recursive function to get all items on a table of DynamoDB
async function scanDynamoRecords(scanParams, itemArray) {
    try {
        let dynamoData = await dynamodb.scan(scanParams).promise();
        itemArray = itemArray.concat(dynamoData.Items);
        if (dynamoData.LastEvaluatedKey) {
            scanParams.ExclusiveStartkey = dynamoData.LastEvaluatedKey;
            return await scanDynamoRecords(scanParams, itemArray);
        }
        return itemArray;
    } catch (error) {
        console.error(error);
    }
}
