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
  logger.info({body: req.body}, 'Call details received');
  
  const { call_sid, call_status, direction, from, to } = req.body;
  
  if (call_status === 'in-progress' || call_status === 'early-media') {
    logger.info('Call answered, sending TTS test...');
    
    // METHOD 3: Simple TTS test with correct Jambonz format
    const response = [
      {
        verb: "say",
        text: "Hello! Testing audio. Can you hear this message? If yes, the audio is working.",
        synthesizer: {
          vendor: "google",
          language: "en-US"
        }
      },
      {
        verb: "pause",
        length: 5  // Wait 5 seconds before hanging up
      }
    ];
    
    logger.info('Sending TTS response to Jambonz');
    logger.info({response: JSON.stringify(response)}, 'TTS verbs');
    res.json(response);
    
  } else if (call_status === 'trying' || call_status === 'ringing') {
    // Don't do anything while call is ringing
    logger.info(`Call ringing - status: ${call_status}`);
    res.json([]);
  } else {
    logger.info(`Call status: ${call_status} - no action taken`);
    res.json([]);
  }
});

// Call status updates
app.post('/call-status', (req, res) => {
  const { call_status, sip_status, duration } = req.body;
  logger.info({
    call_status,
    sip_status,
    duration
  }, 'Call status update');
  
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
    current_test: 'TTS Audio Test',
    timestamp: new Date().toISOString()
  });
});

// Test Retell API connection (fixed endpoint)
app.get('/test-retell', async (req, res) => {
  try {
    const options = {
      hostname: 'api.retellai.com',
      path: '/list-agents',  // Fixed: removed /v2
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    https.get(options, (response) => {
      let body = '';
      response.on('data', (chunk) => body += chunk);
      response.on('end', () => {
        try {
          const data = JSON.parse(body);
          
          if (data.error) {
            res.json({ 
              success: false, 
              error: data.error,
              message: 'API key might be invalid'
            });
          } else {
            const agents = Array.isArray(data) ? data : (data.agents || []);
            res.json({ 
              success: true, 
              api_working: true,
              agents_found: agents.length,
              agent_ids: agents.map(a => a.agent_id || a.id),
              configured_agent_found: agents.some(a => 
                (a.agent_id || a.id) === process.env.RETELL_AGENT_ID
              )
            });
          }
        } catch (e) {
          res.json({ 
            success: false, 
            error: 'Failed to parse response', 
            raw_response: body.substring(0, 200) 
          });
        }
      });
    }).on('error', (error) => {
      res.json({ success: false, error: error.message });
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Log all unmatched requests
app.use((req, res, next) => {
  logger.info(`Unmatched: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Route not found' });
});

// Load WebSocket routes for inbound calls
require('./lib/routes')({logger, makeService});

// Start server
server.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  logger.info('Ready for outbound calls at /outbound-call');
});
