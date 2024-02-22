# fetch-organization-aggregated-consents-registry

## Purpose

Running this script, you will get a CSV file containing all consents for all projects of a given organization. 
It's pretty much the same as going to each of this organization's projects and downloading consents from the Consents Registry. 
Except it saves you lots of clicks, and consents are aggregated into a single CSV file, with an extra column, `projectId`.

## How to use

### Requirements
    
1. Node.js 18 installed
2. An access token from a user of the organization. You can check how to get it on [our Swagger](https://api.axept.io/v1/swagger/api-doc-public/#/Auth%20service/post_auth_local_signin).
3. Your organization's ID. You can find it on [our backoffice](https://admin.axeptio.eu), click on "..." menu in the header, then My Account, then click on your organization's name and scroll down to the bottom of the page. Its ID is here.

### Setup

1. Download/git clone this project, or just download this folder and all its content.
2. Run `npm i`
3. Copy the `.env.sample` file to `.env`, and replace all values by yours (your organization's id, your access token, the start date and end date, YYYY-MM-DD format)

### Get the consents
1. Run `npm run getConsents` and wait for `done` to be printed. Be patient, if you requested a large period and you have lots of consents, it can be be quite long.
2. The results will be stored in the `results` folder as a CSV file.
