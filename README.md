# retellai-audio-socket

This is a [jambonz](https://jambonz.org) [application](https://www.jambonz.org/docs/webhooks/overview/) that allows Retell AI users to connect their agents to any SIP trunking provider or PBX.

For those of you not familiar with jambonz, it is an open source (MIT-licensed) voice gateway for CPaaS, CX/AI, and Voice/AI which is the functional equivalent of Twilio with the added ability to self-host on your own infrastructure (or use our cloud at [jambonz.cloud](https://jambonz.cloud)).  Jambonz lets you bring your own carrier (BYOC) and use features like bidirectional streaming at no additional cost.  Jambonz integrates with literally hundreds of SIP trunk providers, PBXs, and session border controllers.  It is used in large-scale production deployments by some of the largest CX/AI and Communication Service Providers.

## Overview

This application makes use of the Retell AI [Sip Endpoint](https://docs.retellai.com/make-calls/custom-telephony#method-2-dial-to-sip-endpoint).

This is intended to be a sample application that you can start with and later extend. It currently supports these features

- inbound calls are connected to your Retell AI agent for gathering information.

## Installing

Having checked out this repo, do the usual:
```bash
npm ci
```

## Configuring

Edit the [./ecosystem.config.js file](./ecosystem.config.js) and fill in the environment variables where indicated.  Basically, you need to specify your Retell AI api keuy and agent id, and the details of your jambonz environment.

## I'm new to jambonz and I need more help!

Got you covered.  Easiest way to get started is to [create a free trial account on jambonz.cloud](https://jambonz.cloud/register).  Once you have an account, add a Carrier for your chosen SIP trunking provider.  Then add an Application that contains the websocket endpoint that this application exposes.  Add a phone number from your Carrier and connect it to the Application, and you are set to go.

For more details, refer to the [blog post](https://blog.jambonz.org/using-jambonz-for-telephony-integration-with-retell-ai) I mentioned above.

## I have more questions!
Join our Slack channel by going to https://joinslack/jambonz.org.
