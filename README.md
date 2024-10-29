# retell-sip-api

This is a [jambonz](https://jambonz.org) [application](https://www.jambonz.org/docs/webhooks/overview/) that allows Retell AI users to connect their agents to any SIP trunking provider or PBX.

For those of you not familiar with jambonz, it is an open source (MIT-licensed) voice gateway for CPaaS, CX/AI, and Voice/AI which is the functional equivalent of Twilio with the added ability to self-host on your own infrastructure or use our cloud service at [jambonz.cloud](https://jambonz.cloud)).  It has several advantages over Twilio:

- more cost-effective: Twilio's per-minute rounding and surcharges for using features like their voice sdk and bidirectional streaming can be eliminated, and jambonz provides all the same features (and more)
- you can bring your own carrier (jambonz has integrated with hundreds of SIP providers and PBXs)
- run awaywhere: jambonz can run in your cloud, on prem, or you can use our hosted service

jambonz also provides value-added features that you can make use of, such as answering machine detection and playing entry prompts and the like that may be more cost effective to do before connecting calls to the LLM.

## Overview

This application makes use of the Retell AI [Sip Endpoint](https://docs.retellai.com/make-calls/custom-telephony#method-2-dial-to-sip-endpoint).

This is intended to be a sample application that you can start with and later extend. It currently supports these features:

- inbound calls are connected to your Retell AI agent for gathering information.
- you can use the jambonz REST api to make an outbound call via a sip trunk you have added and the connect that call to your Retell agent
- you can receive webhooks from Retell for agent events

These features are described in more detail below.

## Installing

Having checked out this repo, do the usual:
```bash
npm ci
```

## Configuring

There are two environment variables that are required:

- RETELL_API_KEY - your Retell api key
- RETELL_AGENT_ID - your Retell agent id

Having done that you can simply run the app.

```bash
RETELL_API_KEY=xxxx RETELL_AGENT_ID=agent_yyyy node app.js
```

### Inbound calls
To use this application with an inbound call simply configure your jambonnz system to route calls from your carrier/PBX to this application.  In jambonz you can also route calls by phone number to applications if you wish.  The incoming call will be connected immediately to your Retell agent.

### Outbound calls
To use this application for outbound calls, use the jambonz REST API to [create a new call](https://api.jambonz.org/#243a2edd-7999-41db-bd0d-08082bbab401).  To use this you will need to know:

- your jambonz account_sid
- your jambonz api key
- the application_sid of this application (available once you Add Application in jambonz)
- the base URL of the jambonz system you are using (https://api.jambonz.cloud for example on jambonz.cloud)

You can then format and send an HTTP POST to jambonz like this:

```bash
curl --location -g 'https:/{{baseUrl}}/v1/Accounts/{{account_sid}}/Calls' \
--header 'Authorization: Bearer {{api_key}}' \
--header 'Content-Type: application/json' \
--data '{
    "application_sid": "{{application_sid}}",
    "from": "15083728299",
    "to": {
        "type": "phone",
        "number": "15082084809"
    }
}'
```

Of course, substitute in your own from and to phone numbers.  The example above assumes that you have created a BYOC trunk on jambonz that you will use to outdial the user.

## I'm new to jambonz and I need more help!

Got you covered.  Easiest way to get started is to [create a free trial account on jambonz.cloud](https://jambonz.cloud/register).  Once you have an account, add a Carrier for your chosen SIP trunking provider.  Then add an Application that contains the websocket endpoint that this application exposes.  Add a phone number from your Carrier and connect it to the Application, and you are set to go.

For more details, refer to the [blog post](https://blog.jambonz.org/using-jambonz-for-telephony-integration-with-retell-ai) I mentioned above.

## I have more questions!
Join our Slack channel by going to https://joinslack/jambonz.org.
