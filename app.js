const express = require('express');
const app = express();
const {createServer} = require('http');
const {createEndpoint} = require('@jambonz/node-client-ws');
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

// WEBHOOK ROUTES - Handle outbound calls
app.post('/outbound-call', (req, res) => {
  logger.info('=== OUTBOUND CALL WEBHOOK TRIGGERED ===');
  logger.info({body: req.body}, 'Call details received');
  
  const { call_sid, call_status, direction } = req.body;
  
  if (call_status === 'in-progress' || call_status === 'early-media') {
    logger.info('Call answered, connecting to Retell AI...');
    
    const response = [
      {
        verb: "pause",
        length: 0.5
      },
      {
        verb: "connect",
        url: "wss://api.retellai.com/v1/websocket",
        method: "websocket",
        headers: {
          "Authorization": `Bearer ${process.env.RETELL_API_KEY}`,
          "Content-Type": "application/json",
          "x-agent-id": process.env.RETELL_AGENT_ID,
          "x-call-id": call_sid,
          "x-direction": "outbound"
        },
        bidirectionalAudio: {
          enabled: true,
          codec: "PCMU",
          sample_rate: 8000
        },
        timeout: 3600
      }
    ];
    
    logger.info('Sending connect instructions to Jambonz');
    res.json(response);
  } else {
    logger.info(`Call not ready - status: ${call_status}`);
    res.json([]);
  }
});

// Call status updates
app.post('/call-status', (req, res) => {
  logger.info({status: req.body.call_status}, 'Call status update');
  res.sendStatus(200);
});

// Health check endpoint
app.get('/', (req, res) => {
  const hasKey = !!process.env.RETELL_API_KEY;
  const hasAgent = !!process.env.RETELL_AGENT_ID;
  
  res.json({ 
    status: 'running',
    message: 'Retell-Jambonz Integration Active',
    endpoints: ['/outbound-call', '/call-status'],
    environment: {
      retell_api_key: hasKey ? 'configured' : 'missing',
      retell_agent_id: hasAgent ? 'configured' : 'missing',
      agent_preview: hasAgent ? process.env.RETELL_AGENT_ID.substring(0, 10) + '...' : 'not set'
    },
    timestamp: new Date().toISOString()
  });
});

// Log all requests for debugging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - Body: ${JSON.stringify(req.body)}`);
  next();
});

// DON'T load the broken webhooks module - comment it out for now
// const webhooks = require('./lib/webhooks');
// app.use('/', webhooks);

// Load WebSocket routes
require('./lib/routes')({logger, makeService});

// Start server
server.listen(port, () => {
  logger.info(`Server listening at http://localhost:${port}`);
  logger.info('Webhook endpoints ready at /outbound-call and /call-status');
});
