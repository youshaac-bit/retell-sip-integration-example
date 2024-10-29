# retell-sip-api

This is a [jambonz](https://jambonz.org) [application](https://www.jambonz.org/docs/webhooks/overview/) that allows Retell AI users to connect their agents to any SIP trunking provider or PBX.

For those of you not familiar with jambonz, it is an open source (MIT-licensed) voice gateway for CPaaS, CX/AI, and Voice/AI which is the functional equivalent of Twilio with the added ability to self-host on your own infrastructure or use our cloud service at [jambonz.cloud](https://jambonz.cloud)).  It has several advantages over Twilio:

- more cost-effective: Twilio's per-minute rounding and surcharges for using features like their voice sdk and bidirectional streaming can be eliminated, and jambonz provides all the same features (and more)
- you can bring your own carrier (jambonz has integrated with hundreds of SIP providers and PBXs)
- run awaywhere: jambonz can run in your cloud, on prem, or you can use our hosted service

jambonz also provides value-added features that you can make use of, such as answering machine detection and playing entry prompts and the like that may be more cost effective to do before connecting calls to the LLM.

## Overview

This application makes use of the Retell AI [Sip Endpoint](https://docs.retellai.com/make-calls/custom-telephony#method-2-dial-to-sip-endpoint).

This is intended to be a sample application that you can start with and later extend. It currently supports both inbound and outbound calling. Additionally, it supports receiving webhooks from Retell with agent events during a call.

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
To use this application with an inbound call simply configure your jambonz system to route incoming calls to this application. The application will then connect the incoming call to your Retell agent.

### Outbound calls
To use this application for outbound calls, use the [jambonz REST API](https://api.jambonz.org/#243a2edd-7999-41db-bd0d-08082bbab401) to create a new call.  To do this you will need to know:

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

## Various features

### Receiving agent events
To receive agent events, go to the Webhook Settings panel in the Retell dashboard for your agent and add the URL where this application is running, with a path of "/agent-events".  The code [here](./lib/webhooks/endpoints/agent-events.js) will be executed.  Currently this code simply logs they event payloads but you can change to suit your needs.

## I'm new to jambonz and I need more help!

Got you covered.  Easiest way to get started is to [create a free trial account on jambonz.cloud](https://jambonz.cloud/register).  Once you have an account, add a Carrier for your chosen SIP trunking provider.  Then add an Application that contains the websocket endpoint that this application exposes.  The URL of the application should be `wss://your.specific.domain/retell`.  In other words, just make sure the protocol is wss and the path is /retell, the host part will be specific to where you run your websocket application.  

>> And note that you can always use [ngrok](https://ngrok.com/) to run the application locally on your laptop for testing.

Then add a phone number from your Carrier and connect it to the Application, and you are set to go.  When you dial that number the call will be handled by your application, which will forward it on to your Retell agent.

## I have more questions!
Join our Slack channel by going to https://joinslack/jambonz.org.
