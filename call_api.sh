#!/bin/sh
curl -v -X POST -H 'X-Ajax-Synchronization-Token: 1234' --data "endpointName:Customer Methods
methodName:customer by equipment number
httpMethod:GET
methodUri:/equipment/customer/
params[equipment]:12345
params[format]:json
apiId:1287
apiKey:
apiSecret:
basicAuthName:
basicAuthPass:
soapBasicAuthName:
soapBasicAuthPass:
soapWssUserNameTokenAuthName:
soapWssBinarySecurityTokenAuthToken:" http://developer.cokecce.com/io-docs/call-api
