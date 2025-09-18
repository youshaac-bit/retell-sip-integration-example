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

// WEBHOOK ROUTE - Handle outbound calls
app.post('/outbound-call', async (req, res) => {
  logger.info('=== OUTBOUND CALL WEBHOOK TRIGGERED ===');
  
  const { call_sid, call_status, from, to } = req.body;
  
  if (call_status === 'in-progress') {
    logger.info('Call answered, attempting Retell connection...');
    
    // Try different SIP endpoints for Retell
    // Option 1: Direct to Retell's main SIP server
    const response = [
      {
        verb: "dial",
        answerOnBridge: true,
        dtmfCapture: ["*", "#"],
        target: [
          {
            type: "sip",
            sipUri: `sip:${process.env.RETELL_AGENT_ID}@api.retellai.com`,
            headers: {
              "X-Retell-Api-Key": process.env.RETELL_API_KEY,
              "X-Retell-Agent-Id": process.env.RETELL_AGENT_ID
            }
          }
        ],
        actionHook: "/dial-status"
      }
    ];
    
    logger.info('Dialing Retell SIP endpoint at api.retellai.com');
    res.json(response);
    
  } else {
    logger.info(`Call status: ${call_status} - no action`);
    res.json([]);
  }
});

// Dial status webhook
app.post('/dial-status', (req, res) => {
  logger.info({body: req.body}, 'Dial status received');
  
  if (req.body.dial_call_status === 'failed') {
    logger.error({
      status: req.body.dial_call_status,
      sip_status: req.body.dial_sip_status,
      reason: req.body.dial_sip_reason
    }, 'Dial failed');
  }
  
  res.sendStatus(200);
});

// Call status updates
app.post('/call-status', (req, res) => {
  const { call_status, duration } = req.body;
  logger.info({
    call_status,
    duration
  }, 'Call status update');
  
  res.sendStatus(200);
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    message: 'Retell-Jambonz Integration Active',
    method: 'SIP Dial to api.retellai.com',
    endpoints: ['/outbound-call', '/call-status', '/dial-status'],
    timestamp: new Date().toISOString()
  });
});

// Load WebSocket routes
require('./lib/routes')({logger, makeService});

// Start server
server.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  logger.info('Ready for outbound calls');
});
