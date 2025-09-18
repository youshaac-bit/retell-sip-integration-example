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

// Helper function to register call with Retell
function registerCallWithRetell(callData) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      agent_id: process.env.RETELL_AGENT_ID,
      from: callData.from,
      to: callData.to,
      direction: 'outbound',
      call_sid: callData.call_sid
    });

    const options = {
      hostname: 'api.retellai.com',
      port: 443,
      path: '/register-call',
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
          logger.info({response}, 'Retell registration response');
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
  
  // Don't log sensitive data
  logger.info({
    call_sid,
    call_status,
    from,
    to,
    agent_id_prefix: process.env.RETELL_AGENT_ID ? process.env.RETELL_AGENT_ID.substring(0, 10) : 'not set'
  }, 'Call details (sanitized)');
  
  if (call_status === 'in-progress') {
    logger.info('Call answered, connecting to Retell via SIP...');
    
    try {
      // Register the call with Retell first
      const retellResponse = await registerCallWithRetell({
        call_sid,
        from: from || '+27212067414',
        to: to || '+27815164001'
      });
      
      const retellCallId = retellResponse.call_id || retellResponse.retell_call_id;
      
      if (retellCallId) {
        logger.info(`Retell call registered with ID: ${retellCallId}`);
        
        // Use dial verb with SIP URI (LiveKit Cloud endpoint for Retell)
        const response = [
          {
            verb: "dial",
            answerOnBridge: true,
            target: [
              {
                type: "sip",
                sipUri: `sip:${retellCallId}@5t4n6j0wnrl.sip.livekit.cloud`
              }
            ]
          }
        ];
        
        logger.info('Sending dial command to connect to Retell SIP endpoint');
        res.json(response);
      } else {
        throw new Error('No call_id received from Retell');
      }
    } catch (error) {
      logger.error({error: error.message}, 'Failed to setup Retell call');
      
      // Fallback: Simple dial to agent
      const response = [
        {
          verb: "dial",
          answerOnBridge: true,
          target: [
            {
              type: "sip",
              sipUri: `sip:${process.env.RETELL_AGENT_ID}@5t4n6j0wnrl.sip.livekit.cloud`
            }
          ]
        }
      ];
      
      logger.info('Using fallback: Direct dial to Retell agent');
      res.json(response);
    }
    
  } else if (call_status === 'early-media') {
    logger.info('Call in early-media state');
    res.json([]);
  } else {
    logger.info(`Call status: ${call_status}`);
    res.json([]);
  }
});

// Call status updates
app.post('/call-status', (req, res) => {
  const { call_status, duration } = req.body;
  logger.info({
    call_status,
    duration
  }, 'Call status update');
  
  if (duration === 0 && call_status === 'completed') {
    logger.warn('Call failed immediately - check SIP connection');
  }
  
  res.sendStatus(200);
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    message: 'Retell-Jambonz Integration Active',
    method: 'SIP Dial Method',
    endpoints: ['/outbound-call', '/call-status'],
    timestamp: new Date().toISOString()
  });
});

// Test Retell connection
app.get('/test-retell', async (req, res) => {
  res.json({
    message: 'API test endpoint',
    note: 'Credentials hidden for security'
  });
});

// Load WebSocket routes for inbound
require('./lib/routes')({logger, makeService});

// Start server
server.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  logger.info('Using SIP dial method for Retell connection');
});
