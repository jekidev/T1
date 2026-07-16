### Buy Hosting Number - Python Example

Source: https://5sim.net/docs/index

This Python code snippet shows how to purchase a hosting number using the requests library. It constructs the necessary headers and makes a GET request to the API endpoint.

```python
import requests

token = 'Your token'
country = 'england'
operator = 'any'
product = 'amazon'

headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/json',
}

response = requests.get('https://5sim.net/v1/user/buy/hosting/' + country + '/' + operator + '/' + product, headers=headers)
```

--------------------------------

### Get Prices - cURL

Source: https://5sim.net/docs/index

Retrieves the prices for all available products. Sends a GET request with an Accept header.

```shell
curl "https://5sim.net/v1/guest/prices" \
  -H "Accept: application/json"
```

--------------------------------

### Re-buy Number using cURL, Python, and PHP

Source: https://5sim.net/docs/index

These code examples demonstrate how to re-purchase or reuse a phone number associated with a specific product using cURL, Python's requests library, and PHP's cURL functions. They all send a GET request to the /v1/user/reuse endpoint with necessary authentication headers and product/number parameters.

```bash
curl "https://5sim.net/v1/user/reuse/$product/$number" \
  -H "Authorization: Bearer $token" \
  -H "Accept: application/json"
```

```python
import requests

token = 'Your token'
product = 'amazon'
number = '79006665544'

headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/json',
}

response = requests.get('https://5sim.net/v1/user/reuse/' + product + '/' + number, headers=headers)
```

```php
<?php

$token = 'Your token';
$ch = curl_init();
$product = 'amazon';
$number = '79006665544';

curl_setopt($ch, CURLOPT_URL, 'https://5sim.net/v1/user/reuse/' . $product . '/' . $number);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');


$headers = array();
$headers[] = 'Authorization: Bearer ' . $token;
$headers[] = 'Accept: application/json';
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$result = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'Error:' . curl_error($ch);
}
curl_close($ch);

?>
```

--------------------------------

### Get Prices - Python

Source: https://5sim.net/docs/index

Retrieves the prices for all available products using Python's requests library. It sends a GET request to the prices endpoint.

```python
import requests

headers = {
    'Accept': 'application/json',
}

response = requests.get('https://5sim.net/v1/guest/prices', headers=headers)
```

--------------------------------

### Buy Hosting Number - cURL Example

Source: https://5sim.net/docs/index

This snippet demonstrates how to buy a hosting number using cURL. It requires specifying the country, operator, and product, along with an authorization token.

```shell
curl "https://5sim.net/v1/user/buy/hosting/$country/$operator/$product" \
  -H "Authorization: Bearer $token" \
  -H "Accept: application/json"
```

--------------------------------

### GET /guest/prices

Source: https://5sim.net/docs/index

Returns a comprehensive list of product prices, including cost, available quantity, and delivery rate for various countries and operators.

```APIDOC
## GET /guest/prices

### Description
Returns product prices, including cost, available quantity, and delivery rate.

### Method
GET

### Endpoint
https://5sim.net/v1/guest/prices

### Response
#### Success Response (200)
- **cost** (float) - Virtual number price, formatted to two decimal places.
- **count** (number) - Available quantity.
- **rate** (float) - Delivery percentage, formatted to two decimal places. This field may be omitted if the rate is less than 20% or if there have been too few orders.

### Response Example
```json
{
  "england": {
    "facebook": {
      "vodafone": {"cost": 4, "count": 1260, "rate": 99.99},
      "virtual60": {"cost": 4, "count": 935, "rate": 99.99},
      "virtual52": {"cost": 4, "count": 0, "rate": 99.99}
    }
  }
}
```
```

--------------------------------

### GET /guest/products/{country}/{operator}

Source: https://5sim.net/docs/index

Retrieves a list of all available products, their categories, quantities, and prices for a given country and operator.

```APIDOC
## GET /guest/products/{country}/{operator}

### Description
Retrieves the name, price, and quantity of all products available for purchase within a specified country and operator.

### Method
GET

### Endpoint
https://5sim.net/v1/guest/products/$country/$operator

### Parameters
#### Path Parameters
- **country** (string) - Required - The country for which to retrieve products. Use 'any' for any country.
- **operator** (string) - Required - The operator for which to retrieve products. Use 'any' for any operator.

### Response
#### Success Response (200)
- **Category** (string) - The category of the product (e.g., 'hosting', 'activation').
- **Qty** (number) - The available quantity of the product.
- **Price** (number) - The price of the product.

### Response Example
```json
{
  "1day": {"Category": "hosting", "Qty": 14, "Price": 80},
  "facebook": {"Category": "activation", "Qty": 133, "Price": 21}
}
```
```

--------------------------------

### Buy Hosting Number - PHP Example

Source: https://5sim.net/docs/index

This PHP code snippet illustrates how to buy a hosting number using cURL. It sets up the URL, headers, and various cURL options to make the API request.

```php
<?php

$token = 'Your token';
$ch = curl_init();
$country = 'england';
$operator = 'any';
$product = 'amazon';

curl_setopt($ch, CURLOPT_URL, 'https://5sim.net/v1/user/buy/hosting/' . country . '/' . operator . '/' . product);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');


$headers = array();
$headers[] = 'Authorization: Bearer ' . $token;
$headers[] = 'Accept: application/json';
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$result = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'Error:' . curl_error($ch);
}
curl_close($ch);

?>
```

--------------------------------

### Get Countries List - Sample Response

Source: https://5sim.net/docs/index

An example of the JSON response received when requesting the list of countries. Each country is represented as an object with nested information such as ISO codes, phone prefixes, and availability for different virtual number types.

```json
{
  "afghanistan":{
    "iso":{
      "af":1
    },
    "prefix":{
      "+93":1
    },
    "text_en":"Afghanistan",
    "virtual18":{
      "activation":1
    },
    "virtual21":{
      "activation":1
    },
    "virtual23":{
      "activation":1
    },
    "virtual4":{
      "activation":1
    }
  }
}
```

--------------------------------

### Get Prices - PHP

Source: https://5sim.net/docs/index

Retrieves the prices for all available products using PHP cURL. It constructs a GET request to the prices endpoint.

```php
<?php

$ch = curl_init();

curl_setopt($ch, CURLOPT_URL, 'https://5sim.net/v1/guest/prices');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');


$headers = array();
$headers[] = 'Accept: application/json';
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$result = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'Error:' . curl_error($ch);
}
curl_close($ch);

?>
```

--------------------------------

### GET /v1/guest/prices

Source: https://5sim.net/docs/index

Retrieves product prices by country and a specific product. Requires 'country' and 'product' as query parameters.

```APIDOC
## GET /v1/guest/prices

### Description
Returns product prices by country and specific product.

### Method
GET

### Endpoint
https://5sim.net/v1/guest/prices

### Parameters
#### Query Parameters
- **country** (string) - Required - Country name
- **product** (string) - Required - Product name

### Request Example
```json
{
  "country": "england",
  "product": "facebook"
}
```

### Response
#### Success Response (200)
- **cost** (float) - Virtual number price, two decimal places
- **count** (number) - Available quantity
- **rate** (float) - Delivery percentage, two decimal places, omitted less than 20% or too few orders

#### Response Example
```json
{
  "england": {
    "facebook": {
      "vodafone": {
        "cost": 8,
        "count": 0,
        "rate": 99.99
      },
      "matrix": {
        "cost": 8,
        "count": 0,
        "rate": 99.99
      }
    }
  }
}
```

#### Error Response
- **400** - country is incorrect
- **400** - product is incorrect
```

--------------------------------

### Get Prices by Product - Python

Source: https://5sim.net/docs/index

Fetches virtual number prices for a particular product using Python's requests library. It makes a GET request to the /prices endpoint, specifying the 'product' parameter and the 'Accept: application/json' header. The output details pricing per country.

```python
import requests

product = 'facebook'

headers = {
    'Accept': 'application/json',
}

params = (
    ('product', product),
)

response = requests.get('https://5sim.net/v1/guest/prices', headers=headers, params=params)
```

--------------------------------

### GET /v1/guest/prices?product={product}

Source: https://5sim.net/docs/index

Retrieves product prices for a specific product across different countries. This endpoint helps in comparing the costs of a particular service globally.

```APIDOC
## GET /v1/guest/prices?product={product}

### Description
Retrieves product prices for a specific product across different countries. This endpoint helps in comparing the costs of a particular service globally.

### Method
GET

### Endpoint
`/v1/guest/prices`

### Parameters
#### Query Parameters
- **product** (string) - Required - The name of the product for which to retrieve prices.

### Request Example
```json
{
  "product": "facebook"
}
```

### Response
#### Success Response (200)
- **cost** (float) - Virtual number price, two decimal places.
- **count** (number) - Available quantity.
- **rate** (float) - Delivery percentage, two decimal places, omitted less than 20% or too few orders.

#### Response Example
```json
{
  "facebook":{
    "afghanistan":{
      "virtual18":{
        "cost":4,
        "count":1260,
        "rate": 99.99
      },
      "virtual23":{
        "cost":4,
        "count":935,
        "rate": 99.99
      },
      "virtual4":{
        "cost":4,
        "count":0,
        "rate": 99.99
      }
    }
  }
}
```

#### Error Response (400)
- **message** (string) - Indicates that the provided product is incorrect.
```

--------------------------------

### Get Products by Country and Operator - Python

Source: https://5sim.net/docs/index

Retrieves a list of products available for a specific country and operator using Python's requests library. It sends a GET request with country and operator in the URL.

```python
import requests

country = 'england'
operator = 'any'

headers = {
    'Accept': 'application/json',
}

response = requests.get('https://5sim.net/v1/guest/products/' + country + '/' + operator, headers=headers)
```

--------------------------------

### Get Products by Country and Operator - cURL

Source: https://5sim.net/docs/index

Retrieves a list of products available for a specific country and operator. Requires country and operator as path parameters and an Accept header.

```shell
curl "https://5sim.net/v1/guest/products/$country/$operator" \
  -H "Accept: application/json"
```

--------------------------------

### Get Prices by Product - PHP

Source: https://5sim.net/docs/index

Utilizes cURL in PHP to obtain virtual number prices for a given product. It sends a GET request to the /prices endpoint, including the 'product' parameter and appropriate headers. The script handles the cURL execution and potential errors.

```php
<?php

$ch = curl_init();
$product = 'facebook';

curl_setopt($ch, CURLOPT_URL, 'https://5sim.net/v1/guest/prices?product=' . $product);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');

$headers = array();
$headers[] = 'Accept: application/json';
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$result = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'Error:' . curl_error($ch);
}
curl_close($ch);

?>
```

--------------------------------

### Get Products by Country and Operator - PHP

Source: https://5sim.net/docs/index

Retrieves a list of products available for a specific country and operator using PHP cURL. It constructs a GET request with country and operator in the URL.

```php
<?php

$ch = curl_init();
$country = 'england';
$operator= 'any';

curl_setopt($ch, CURLOPT_URL, 'https://5sim.net/v1/guest/products/' . $country . '/' . $operator);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');


$headers = array();
$headers[] = 'Accept: application/json';
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$result = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'Error:' . curl_error($ch);
}
curl_close($ch);

?>
```

--------------------------------

### Get Prices by Country and Product (5sim.net API)

Source: https://5sim.net/docs/index

Retrieves pricing information for virtual numbers based on country and product. Requires 'Accept: application/json' header. Parameters 'country' and 'product' are mandatory query parameters.

```curl
curl "https://5sim.net/v1/guest/prices?country=$country&product=$product" \
  -H "Accept: application/json"
```

```python
import requests

country = 'england'
product = 'facebook'

headers = {
    'Accept': 'application/json',
}

params = (
    ('country', country),
    ('product', product),
)

response = requests.get('https://5sim.net/v1/guest/prices', headers=headers, params=params)
```

```php
<?php

$ch = curl_init();
$country = 'england';
$product = 'facebook';

curl_setopt($ch, CURLOPT_URL, 'https://5sim.net/v1/guest/prices?country=' . $country . '&product=' . $product);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');

$headers = array();
$headers[] = 'Accept: application/json';
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$result = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'Error:' . curl_error($ch);
}
curl_close($ch);
```

--------------------------------

### Check Order Status using cURL, Python, and PHP

Source: https://5sim.net/docs/index

These code examples illustrate how to check the status of an order and retrieve associated SMS messages using cURL, Python's requests library, and PHP's cURL functions. They all make a GET request to the /v1/user/check endpoint, requiring an order ID and authentication token.

```bash
curl "https://5sim.net/v1/user/check/$id" \
  -H "Authorization: Bearer $token" \
  -H "Accept: application/json"
```

```python
import requests

token = 'Your token'
id = 1

headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/json',
}

response = requests.get('https://5sim.net/v1/user/check/' + str(id), headers=headers)
```

```php
<?php

$token = 'Your token';
$ch = curl_init();
$id = 1;

curl_setopt($ch, CURLOPT_URL, 'https://5sim.net/v1/user/check/' . $id);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');


$headers = array();
$headers[] = 'Authorization: Bearer ' . $token;
$headers[] = 'Accept: application/json';
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$result = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'Error:' . curl_error($ch);
}
curl_close($ch);

?>
```

--------------------------------

### Get Price Limits

Source: https://5sim.net/docs/index

Retrieves a list of established price limits for products. Requires an Authorization header with a bearer token. Returns an array of objects, each containing the product ID, name, price, and creation timestamp.

```curl
curl "https://5sim.net/v1/user/max-prices" \
  -H "Authorization: Bearer $token" \
  -H "Accept: application/json"
```

```python
import requests

headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/json',
}

response = requests.get('https://5sim.net/v1/user/max-prices', headers=headers)
```

```php
<?php

$token = 'Your token';
$ch = curl_init();

curl_setopt($ch, CURLOPT_URL, 'https://5sim.net/v1/user/max-prices');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');


$headers = array();
$headers[] = 'Authorization: Bearer ' . $token;
$headers[] = 'Accept: application/json';
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$result = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'Error:' . curl_error($ch);
}
curl_close($ch);


```

--------------------------------

### SMS Structure Example (JSON)

Source: https://5sim.net/docs/index

This JSON object demonstrates the structure of an SMS message as returned by the API. It includes fields for creation timestamp, reception date, sender, the full text of the message, and the extracted activation code.

```json
{
    "sms": [
        {
            "created_at":"1970-12-01T17:23:25.106597Z",
            "date":"1970-12-01T17:23:15Z",
            "sender":"Facebook",
            "text":"Use 415127 as your login code",
            "code":"415127"
        }
    ]
}
```

--------------------------------

### Get Prices List

Source: https://5sim.net/docs/index

Retrieves a list of vendor prices, including product, country, and operator information, with options for filtering and sorting.

```APIDOC
## GET /v1/vendor/prices

### Description
Get prices list for vendors.

### Method
GET

### Endpoint
https://5sim.net/v1/vendor/prices

### Query Parameters
- **_filters.ID** (query string) - No - Filter by record ID
- **_filters.CountryName** (query string) - No - Filter by country
- **_filters.ProductName** (query string) - No - Filter by product
- **_filters.OperatorName** (query string) - No - Filter by mobile operator
- **_filters.Count** (query string) - No - Filter by available numbers count
- **_filters.Rate** (query string) - No - Filter by rate value
- **_filters.Price** (query string) - No - Filter by current price
- **_filters.Hours** (query string) - No - Filter by time validity
- **_filters.DeletedAt** (query string) - No - Filter by deletion date
- **_filters.NewPrice** (query string) - No - Filter by new/updated price
- **_filters.NewPriceUpdatedAt** (query string) - No - Filter by last update date of new price
- **_sortDir** (query string) - No - Sorting direction, can be ASC or DESC
- **_sortField** (query string) - No - Field name to sort by (e.g., Price, Rate, Count)
- **_page** (query string) - No - Page number for pagination
- **_perPage** (query string) - No - Number of items per page

### Request Example
```bash
curl "https://5sim.net/v1/vendor/prices?_filters[ID]=333567&_sortField=Price&_sortDir=DESC"
  -H "Authorization: Bearer $token"
  -H "Accept: application/json"
```

### Response
#### Success Response (200)
- **Prices** (array) - Prices list
- **Products** (array) - Products list
- **Countries** (array) - Countries list
- **Operators** (array) - Operators list
- **Total** (number) - Total prices count

#### Response Example
```json
{
  "Prices": [
    {
      "Count": 0,
      "CountryName": "england",
      "ID": 333567,
      "OperatorName": "virtual16",
      "Price": 22,
      "ProductName": "facebook"
    }
  ],
  "Products": ["facebook"],
  "Country": ["england"],
  "Operators": ["virtual16"],
  "Total": 1
}
```
```

--------------------------------

### Get Notifications

Source: https://5sim.net/docs/index

Retrieves notifications for the authenticated user. Supports language selection.

```APIDOC
## GET /v1/guest/flash/{lang}

### Description
Retrieves notifications for the authenticated user. Supports language selection.

### Method
GET

### Endpoint
`https://5sim.net/v1/guest/flash/{lang}`

### Parameters
#### Path Parameters
- **lang** (string) - Required - Language of notification, e.g., 'en'.

#### Headers
- **Authorization** (string) - Required - Bearer token for authentication.
- **Accept** (string) - Optional - Specifies the desired response format, typically 'application/json'.

### Response
#### Success Response (200 OK)
- **text** (string) - The content of the notification.

#### Response Example
```json
{
  "text": "...notification text..."
}
```
```

--------------------------------

### Get Prices by Product - cURL

Source: https://5sim.net/docs/index

Retrieves available virtual number prices for a specified product. Requires the 'product' query parameter. The response is structured by country and then by virtual number type, showing cost, count, and rate.

```curl
curl "https://5sim.net/v1/guest/prices?product=$product" \
  -H "Accept: application/json"
```

--------------------------------

### GET /v1/guest/prices?country={country}

Source: https://5sim.net/docs/index

Retrieves product prices for a specified country. This endpoint is useful for understanding the cost and availability of virtual numbers for different services within a particular region.

```APIDOC
## GET /v1/guest/prices?country={country}

### Description
Retrieves product prices by country. This endpoint is useful for understanding the cost and availability of virtual numbers for different services within a particular region.

### Method
GET

### Endpoint
`/v1/guest/prices`

### Parameters
#### Query Parameters
- **country** (string) - Required - The name of the country for which to retrieve prices.

### Request Example
```json
{
  "country": "england"
}
```

### Response
#### Success Response (200)
- **cost** (float) - Virtual number price, two decimal places.
- **count** (number) - Available quantity.
- **rate** (float) - Delivery percentage, two decimal places, omitted less than 20% or too few orders.

#### Response Example
```json
{
  "england":{
    "facebook":{
      "vodafone":{
        "cost":4,
        "count":1260,
        "rate": 99.99
      },
      "virtual60":{
        "cost":4,
        "count":935,
        "rate": 99.99
      },
      "virtual52":{
        "cost":4,
        "count":0,
        "rate": 99.99
      }
    }
  }
}
```

#### Error Response (400)
- **message** (string) - Indicates that the provided country is incorrect.
```

--------------------------------

### Get Notifications via API (cURL, Python, PHP)

Source: https://5sim.net/docs/index

This snippet demonstrates how to retrieve notifications from the 5Sim API. It supports language selection and requires an authorization token. The response contains the notification text.

```curl
curl "https://5sim.net/v1/guest/flash/$lang" \
  -H "Authorization: Bearer $token" \
  -H "Accept: application/json"
```

```python
import requests

token = 'Your token'
lang = 'en'

headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/json',
}

response = requests.get('https://5sim.net/v1/guest/flash/' + lang, headers=headers)
```

```php
<?php

$token = 'Your token';
$ch = curl_init();
$lang = 'en';

curl_setopt($ch, CURLOPT_URL, 'https://5sim.net/v1/guest/flash/' . $lang);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');


$headers = array();
$headers[] = 'Authorization: Bearer ' . $token;
$headers[] = 'Accept: application/json';
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$result = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'Error:' . curl_error($ch);
}
curl_close($ch);

?>
```

--------------------------------

### Get Wallets Reserve via API (cURL, Python, PHP)

Source: https://5sim.net/docs/index

This snippet demonstrates how to retrieve wallet reserve information from the 5Sim API. It requires an authorization token and returns the available balances for different payment methods like fkwallet, payeer, and unitpay.

```curl
curl "https://5sim.net/v1/vendor/wallets" \
  -H "Authorization: Bearer $token" \
  -H "Accept: application/json"
```

```python
import requests

token = 'Your token'

headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/json',
}

response = requests.get('https://5sim.net/v1/vendor/wallets', headers=headers)
```

```php
<?php

$token = 'Your token';
$ch = curl_init();

curl_setopt($ch, CURLOPT_URL, 'https://5sim.net/v1/vendor/wallets');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');


$headers = array();
$headers[] = 'Authorization: Bearer ' . $token;
$headers[] = 'Accept: application/json';
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$result = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'Error:' . curl_error($ch);
}
curl_close($ch);

?>
```

--------------------------------

### Get User Profile (cURL, Python, PHP)

Source: https://5sim.net/docs/index

Retrieves the authenticated user's profile information, including their ID, email, balance, rating, and default country/operator settings. Requires an 'Authorization' header with a bearer token.

```curl
curl "https://5sim.net/v1/user/profile" \
  -H "Authorization: Bearer $token" \
  -H "Accept: application/json"
```

```python
import requests

token = 'Your token'

headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/json',
}

response = requests.get('https://5sim.net/v1/user/profile', headers=headers)
```

```php
<?php

$token = 'Your token';
$ch = curl_init();

curl_setopt($ch, CURLOPT_URL, 'https://5sim.net/v1/user/profile');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');


$headers = array();
$headers[] = 'Authorization: Bearer ' . $token;
$headers[] = 'Accept: application/json';
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$result = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'Error:' . curl_error($ch);
}
curl_close($ch);

?>
```

--------------------------------

### Get Vendor Payments History (cURL, Python, PHP)

Source: https://5sim.net/docs/index

Retrieves the vendor's payment history with pagination and ordering options. Requires an Authorization token. Parameters include limit, offset, order, and reverse.

```curl
curl "https://5sim.net/v1/vendor/payments?limit=15&offset=0&order=id&reverse=true" \
  -H "Authorization: Bearer $token" \
  -H "Accept: application/json"
```

```python
import requests

token = 'Your token'
limit = 15
offset = 0
order = 'id'
reverse = True

headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/json',
}

params = (
    ('limit', limit),
    ('offset', offset),
    ('order', order),
    ('reverse', reverse),
)

response = requests.get('https://5sim.net/v1/vendor/payments', headers=headers, params=params)
```

```php
<?php

$token = 'Your token';
$ch = curl_init();
$limit = 15;
$offset = 0;
$order = 'id';
$reverse = true;

curl_setopt($ch, CURLOPT_URL, 'https://5sim.net/v1/vendor/payments?&limit=' . $limit . '&offset=' . $offset . '&order=' . $id . '&reverse=' . $reverse);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');


$headers = array();
$headers[] = 'Authorization: Bearer ' . $token;
$headers[] = 'Accept: application/json';
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$result = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'Error:' . curl_error($ch);
}
curl_close($ch);

?>
```

--------------------------------

### Get Vendor Prices List via API

Source: https://5sim.net/docs/index

This endpoint retrieves a list of vendor prices, including product and country details. It requires an Authorization token and accepts various query parameters for filtering and sorting. The response includes price lists, products, countries, operators, and total count.

```curl
curl "https://5sim.net/v1/vendor/prices" \
  -H "Authorization: Bearer $token" \
  -H "Accept: application/json"
```

```python
import requests

token = 'Your token'

headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/json',
}

response = requests.get('https://5sim.net/v1/vendor/prices', headers=headers)
```

```php
<?php

$token = 'Your token';
$ch = curl_init();

curl_setopt($ch, CURLOPT_URL, 'https://5sim.net/v1/vendor/prices');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');


$headers = array();
$headers[] = 'Authorization: Bearer ' . $token;
$headers[] = 'Accept: application/json';
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$result = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'Error:' . curl_error($ch);
}
curl_close($ch);

?>
```

--------------------------------

### Get Vendor Statistics via API (cURL, Python, PHP)

Source: https://5sim.net/docs/index

This snippet shows how to fetch vendor statistics from the 5Sim API. It requires an authorization token and returns details such as vendor ID, email, balance, rating, and default country/operator information.

```curl
curl "https://5sim.net/v1/user/vendor" \
  -H "Authorization: Bearer $token" \
  -H "Accept: application/json"
```

```python
import requests

token = 'Your token'

headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/json',
}

response = requests.get('https://5sim.net/v1/user/vendor', headers=headers)
```

```php
<?php

$token = 'Your token';
$ch = curl_init();

curl_setopt($ch, CURLOPT_URL, 'https://5sim.net/v1/user/vendor');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');


$headers = array();
$headers[] = 'Authorization: Bearer ' . $token;
$headers[] = 'Accept: application/json';
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$result = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'Error:' . curl_error($ch);
}
curl_close($ch);

?>
```

--------------------------------

### Get Prices by Country - PHP

Source: https://5sim.net/docs/index

Uses cURL in PHP to get virtual number prices for a specific country. It constructs a GET request to the /prices endpoint, including the 'country' parameter and necessary headers. The result is fetched and error handling is provided.

```php
<?php

$ch = curl_init();
$country = 'england';

curl_setopt($ch, CURLOPT_URL, 'https://5sim.net/v1/guest/prices?country=' . $country);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');


$headers = array();
$headers[] = 'Accept: application/json';
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$result = curl_exec($ch);
if (curl_errno($ch)) {
    echo 'Error:' . curl_error($ch);
}
curl_close($ch);

?>
```

--------------------------------

### Price Limit API

Source: https://5sim.net/docs/index

Manages price limits for different products.

```APIDOC
## GET /v1/user/max-prices

### Description
Get a list of established price limits per product.

### Method
GET

### Endpoint
https://5sim.net/v1/user/max-prices

### Headers
- **Authorization** (string) - Required - Bearer token
- **Accept** (string) - Required - application/json

### Response
#### Success Response (200)
- **id** (number) - ID of the price limit entry
- **product** (string) - Name of the product
- **price** (number) - The maximum allowed price
- **CreatedAt** (string) - The date and time when the object was created

### Response Example
```json
[
    {
      "id": 14,
      "product": "facebook",
      "price": 11,
      "CreatedAt": "2020-06-24T15:37:08.149895Z"
    }
]
```

#### Error Response (401)
- Unauthorized access.

## POST /v1/user/max-prices

### Description
Create or update the price limit for a specific product.

### Method
POST

### Endpoint
https://5sim.net/v1/user/max-prices

### Headers
- **Authorization** (string) - Required - Bearer token
- **Accept** (string) - Required - application/json

### Request Body
- **product_name** (string) - Required - The name of the product for which to set the price limit.
- **price** (number) - Required - The maximum price limit for the product.

### Request Example
```json
{
  "product_name": "facebook",
  "price": 30
}
```
```

--------------------------------

### POST /v1/user/buy/activation

Source: https://5sim.net/docs/index

Purchases an activation number for a given country, operator, and product. Requires an Authorization token.

```APIDOC
## POST /v1/user/buy/activation

### Description
Buy activation number.

### Method
GET

### Endpoint
https://5sim.net/v1/user/buy/activation/$country/$operator/$product
https://5sim.net/v1/user/buy/activation/$country/$operator/$product?forwarding=$forwarding&number=$number&reuse=$reuse&voice=$voice&ref=$ref

### Headers
- **Authorization** (string) - Required - Bearer $token
- **Accept** (string) - application/json

### URL Parameters
- **country** (string) - Required - The country, "any" - any country
- **operator** (string) - Required - The operator, "any" - any operator
- **product** (string) - Required - Product name
- **forwarding** (boolean) - Optional
- **number** (string) - Optional
- **reuse** (boolean) - Optional
- **voice** (boolean) - Optional
- **ref** (string) - Optional

### Request Example
```json
{
  "country": "england",
  "operator": "any",
  "product": "amazon"
}
```

### Response
#### Success Response (200)
- **id** (number) - Unique identifier for the activation
- **phone** (string) - The purchased phone number
- **operator** (string) - The operator of the phone number
- **product** (string) - The product associated with the activation
- **price** (number) - The price of the activation
- **status** (string) - Current status of the activation (e.g., PENDING)
- **expires** (string) - Expiration timestamp of the activation
- **sms** (string or null) - SMS messages received (null if none)
- **created_at** (string) - Timestamp when the activation was created
- **forwarding** (boolean) - Whether forwarding is enabled
- **forwarding_number** (string) - The number for forwarding, if enabled
- **country** (string) - The country of the purchased number

#### Response Example
```json
{
  "id": 11631253,
  "phone": "+447350690992",
  "operator": "vodafone",
  "product": "facebook",
  "price": 21,
  "status": "PENDING",
  "expires": "2018-10-13T08:28:38.809469028Z",
  "sms": null,
  "created_at": "2018-10-13T08:13:38.809469028Z",
  "forwarding": false,
  "forwarding_number": "",
  "country": "england"
}
```
```

--------------------------------

### Get Prices by Country - Python

Source: https://5sim.net/docs/index

Fetches virtual number prices for a given country using the Python requests library. It sends a GET request to the /prices endpoint with the 'country' parameter and 'Accept: application/json' header. The response is a JSON object detailing pricing.

```python
import requests

country = 'england'

headers = {
    'Accept': 'application/json',
}

params = (
    ('country', country),
)

response = requests.get('https://5sim.net/v1/guest/prices', headers=headers, params=params)
```

--------------------------------

### GET /v1/vendor/payments

Source: https://5sim.net/docs/index

Retrieves the vendor's payment history with pagination options.

```APIDOC
## GET /v1/vendor/payments

### Description
Provides vendor's payments history.

### Method
GET

### Endpoint
https://5sim.net/v1/vendor/payments

### Query Parameters
- **limit** (string) - Optional - Pagination limit
- **offset** (string) - Optional - Pagination offset
- **order** (string) - Optional - Pagination order, should be field name
- **reverse** (string) - Optional - Is reversed history, true / false

### Headers
- **Authorization** (string) - Bearer $token
- **Accept** (string) - application/json

### Request Example
```json
{
  "example": "curl \"https://5sim.net/v1/vendor/payments?limit=15&offset=0&order=id&reverse=true\" \
  -H \"Authorization: Bearer $token\" \
  -H \"Accept: application/json\""
}
```

### Response
#### Success Response (200 OK)
- **Data** (array) - Payments list
- **PaymentProviders** (array) - Names of payments systems
- **PaymentStatuses** (array) - Payments statuses
- **PaymentTypes** (array) - Payments types
- **Total** (number) - Payments count

#### Response Example
```json
{
  "example": "{\n  \"Data\": [],\n  \"PaymentProviders\":null,\n  \"PaymentStatuses\":null,\n  \"PaymentTypes\":null,\n  \"Total\":3\n}"
}
```
```

--------------------------------

### Buy Hosting Number

Source: https://5sim.net/docs/index

This endpoint allows you to buy a hosting number for a specified country, operator, and product. You can also configure forwarding, reuse, and voice call options.

```APIDOC
## GET /v1/user/buy/hosting/{country}/{operator}/{product}

### Description
Allows you to buy a hosting number for a specified country, operator, and product. Supports various optional query parameters to customize the purchase.

### Method
GET

### Endpoint
`/v1/user/buy/hosting/{country}/{operator}/{product}`

### Parameters
#### Path Parameters
- **country** (string) - Required - The country for the phone number.
- **operator** (string) - Required - The operator for the phone number.
- **product** (string) - Required - The product associated with the phone number (e.g., "amazon", "facebook").

#### Query Parameters
- **forwarding** (query string) - Optional - Whether or not to enable call forwarding.
- **number** (query string) - Optional - The 11-digit number (without '+') for which the call will be forwarded.
- **reuse** (query string) - Optional - If set to "1", buy with the ability to reuse the number if available.
- **voice** (query string) - Optional - If set to "1", buy with the ability to receive a call from the robot, if available.
- **ref** (query string) - Optional - Your referral key if you have one.
- **maxPrice** (query string) - Optional - Maximum price for the purchase, prioritized over settings in 'Max purchase price' section and only works if operator is set to 'any'.

### Request Example
```http
GET https://5sim.net/v1/user/buy/hosting/england/any/amazon?forwarding=1&number=12345678901
Host: 5sim.net
Authorization: Bearer YOUR_API_TOKEN
Accept: application/json
```

### Response
#### Success Response (200 OK)
- **id** (number) - Order ID.
- **phone** (string) - The purchased phone number.
- **operator** (string) - The operator of the phone number.
- **product** (string) - The product associated with the number.
- **price** (number) - The price of the number.
- **status** (string) - The current status of the order (e.g., "PENDING").
- **expires** (date string) - The expiration date of the order.
- **sms** (array) - A list of SMS messages received for this number.
- **created_at** (date string) - The timestamp when the order was created.
- **forwarding** (boolean) - Indicates if call forwarding is enabled.
- **forwarding_number** (string) - The number to which calls are forwarded.
- **country** (string) - The country of the phone number.

#### Response Example
```json
{
  "id": 1,
  "phone": "+447350690992",
  "operator": " Vodafone",
  "product": "amazon",
  "price": 1,
  "status": "PENDING",
  "expires": "1970-12-01T03:00:00.000000Z",
  "sms": [
      {
        "id":3027531,
        "created_at":"1970-12-01T17:23:25.106597Z",
        "date":"1970-12-01T17:23:15Z",
        "sender":"Facebook",
        "text":"Use 415127 as your login code",
        "code":"415127"
      }
    ],
  "created_at": "1970-12-01T00:00:00.000000Z",
  "forwarding": false,
  "forwarding_number": null,
  "country": "england"
}
```

#### Error Responses
- **400 Bad Request**:
  - `not enough user balance`
  - `not enough rating`
  - `select country`
  - `select operator`
  - `bad country`
  - `bad operator`
  - `no product`
  - `server offline`
- **500 Internal Server Error**
```

--------------------------------

### GET /countries

Source: https://5sim.net/docs/index

Retrieves a list of available countries for virtual number services.

```APIDOC
## Countries List

### Description
Retrieves a list of countries supported by the 5SIM.net service.

### Method
GET

### Endpoint
https://5sim.net/v1/countries

### Parameters
None

### Response
#### Success Response (200)
- **countries** (object) - An object where keys are country codes and values are country names.

#### Response Example (Success)
```json
{
  "countries": {
    "af": "Afghanistan",
    "al": "Albania",
    "dz": "Algeria",
    "as": "American Samoa",
    "ad": "Andorra"
    // ... more countries
  }
}
```
```