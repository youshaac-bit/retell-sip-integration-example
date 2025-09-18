const express = require('express');
const app = express();
const {createServer} = require('http');
const {createEndpoint} = require('@jambonz/node-client-ws');
const https = require('https');
const server = createServer(app);
const makeService = createEndpoint({server});
const logger = require('pino')({level: process.env.LOGLEVEL || 'info'});
const port = process.env.WS_PORT || process.env.PORT || 3000;

app.locals = {
  ...app.locals,
  logger
};

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Helper function to register call with Retell (THIS WAS MISSING!)
function registerPhoneCall(callData) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      agent_id: process.env.RETELL_AGENT_ID,
      from_number: callData.from,
      to_number: callData.to,
      direction: 'outbound_call',
      retell_llm_dynamic_variables: {
        customer_name: callData.customer_name || 'Customer',
        call_sid: callData.call_sid
      }
    });

    const options = {
      hostname: 'api.retellai.com',
      port: 443,
      path: '/v2/register-phone-call', // Correct endpoint!
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          logger.info({response}, 'Retell registration successful');
          resolve(response);
        } catch (e) {
          logger.error({error: e, data}, 'Failed to parse Retell response');
          reject(e);
        }
      });
    });

    req.on('error', (error) => {
      logger.error({error}, 'Failed to register with Retell');
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// WEBHOOK ROUTE - Handle outbound calls
app.post('/outbound-call', async (req, res) => {
  logger.info('=== OUTBOUND CALL WEBHOOK TRIGGERED ===');
  
  const { call_sid, call_status, from, to } = req.body;
  
  if (call_status === 'in-progress') {
    try {
      logger.info('Step 1: Registering call with Retell...');
      
      // STEP 1: Register the call with Retell
      const registration = await registerPhoneCall({
        from: from || '+27212067414',
        to: to || '+27815164001',
        call_sid: call_sid,
        customer_name: 'Customer'
      });
      
      if (!registration.call_id) {
        throw new Error('No call_id received from Retell');
      }
      
      logger.info(`Step 2: Got call_id: ${registration.call_id}`);
      
      // STEP 2: Dial to Retell using the call_id
      const response = [
        {
          verb: "dial",
          answerOnBridge: true,
          target: [
            {
              type: "sip",
              sipUri: `sip:${registration.call_id}@5t4n6j0wnrl.sip.livekit.cloud`
            }
          ],
          actionHook: "/dial-status"
        }
      ];
      
      logger.info(`Step 3: Dialing SIP URI: sip:${registration.call_id}@5t4n6j0wnrl.sip.livekit.cloud`);
      res.json(response);
      
    } catch (error) {
      logger.error({error: error.message}, 'Registration failed');
      
      // Fallback - inform caller of error
      res.json([
        {
          verb: "say",
          text: "Sorry, there was a technical error connecting your call.",
          synthesizer: {
            vendor: "elevenlabs",
            voice: "Xb7hH8MSUJpSbSDYk0k2"
          }
        }
      ]);
    }
  } else {
    logger.info(`Call status: ${call_status} - no action`);
    res.json([]);
  }
});

// Dial status webhook - to debug SIP connection issues
app.post('/dial-status', (req, res) => {
  logger.info({
    dial_status: req.body.dial_call_status,
    sip_status: req.body.dial_sip_status,
    sip_reason: req.body.dial_sip_reason
  }, 'Dial attempt result');
  res.sendStatus(200);
});

// Call status updates
app.post('/call-status', (req, res) => {
  logger.info({
    call_status: req.body.call_status,
    duration: req.body.duration
  }, 'Call status update');
  res.sendStatus(200);
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    message: 'Retell-Jambonz Integration (Method 2: Dial to SIP URI)',
    sip_endpoint: '5t4n6j0wnrl.sip.livekit.cloud',
    method: 'Register then Dial',
    endpoints: ['/outbound-call', '/call-status', '/dial-status'],
    timestamp: new Date().toISOString()
  });
});

// Load WebSocket routes
require('./lib/routes')({logger, makeService});

// Start server
server.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  logger.info('Using Method 2: Register Phone Call then Dial to SIP URI');
});
