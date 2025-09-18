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
async function registerCallWithRetell(callData) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      agent_id: process.env.RETELL_AGENT_ID,
      audio_websocket_protocol: "web",
      audio_encoding: "mulaw",
      sample_rate: 8000,
      from_number: callData.from,
      to_number: callData.to
    });

    const options = {
      hostname: 'api.retellai.com',
      path: '/v2/create-web-call',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          logger.info({result}, 'Retell registration response');
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// WEBHOOK ROUTE - Handle outbound calls
app.post('/outbound-call', async (req, res) => {
  logger.info('=== OUTBOUND CALL WEBHOOK TRIGGERED ===');
  logger.info({body: req.body}, 'Call details received');
  
  const { call_sid, call_status, direction, from, to } = req.body;
  
  if (call_status === 'in-progress' || call_status === 'early-media') {
    logger.info('Call answered, attempting to connect to Retell AI...');
    
    // METHOD 1: Try direct WebSocket connection (original method)
    // Uncomment this block to try Method 1
    /*
    const response = [
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
    logger.info('Using Method 1: Direct WebSocket');
    res.json(response);
    */
    
    // METHOD 2: Register with Retell first, then connect
    // Uncomment this block to try Method 2
    /*
    try {
      logger.info('Method 2: Registering call with Retell first...');
      const retellResponse = await registerCallWithRetell({
        call_sid,
        from: from || '27212067414',
        to: to || 'unknown'
      });
      
      if (retellResponse.call_id) {
        logger.info(`Retell call registered: ${retellResponse.call_id}`);
        
        const response = [
          {
            verb: "connect",
            url: retellResponse.websocket_url || `wss://api.retellai.com/v2/call/${retellResponse.call_id}`,
            method: "websocket",
            bidirectionalAudio: {
              enabled: true,
              codec: "PCMU",
              sample_rate: 8000
            }
          }
        ];
        
        res.json(response);
      } else {
        throw new Error('No call_id in Retell response');
      }
    } catch (error) {
      logger.error({error}, 'Failed to register with Retell');
      res.json([{
        verb: "say",
        text: "Sorry, there was a technical error connecting the call."
      }]);
    }
    */
    
    // METHOD 3: Simple TTS test to verify audio works
    // This is currently active - comment out and uncomment Method 1 or 2 to try them
    logger.info('Method 3: Testing with simple TTS');
    const response = [
      {
        verb: "say",
        text: "Hello! This is a test message. If you can hear this, the audio connection is working. Now we need to connect to Retell AI."
      },
      {
        verb: "pause",
        length: 2
      },
      {
        verb: "hangup"
      }
    ];
    res.json(response);
    
  } else {
    logger.info(`Call not ready - status: ${call_status}`);
    res.json([]);
  }
});

// Call status updates
app.post('/call-status', (req, res) => {
  logger.info({status: req.body.call_status, sip_status: req.body.sip_status}, 'Call status update');
  
  // Log more details if call fails
  if (req.body.call_status === 'failed' || req.body.call_status === 'completed') {
    logger.info({
      call_sid: req.body.call_sid,
      duration: req.body.duration,
      sip_status: req.body.sip_status,
      sip_reason: req.body.sip_reason
    }, 'Call ended');
  }
  
  res.sendStatus(200);
});

// WebSocket status endpoint
app.post('/websocket-status', (req, res) => {
  logger.info({body: req.body}, 'WebSocket status update');
  res.sendStatus(200);
});

// Health check endpoint
app.get('/', (req, res) => {
  const hasKey = !!process.env.RETELL_API_KEY;
  const hasAgent = !!process.env.RETELL_AGENT_ID;
  
  res.json({ 
    status: 'running',
    message: 'Retell-Jambonz Integration Active',
    endpoints: ['/outbound-call', '/call-status', '/websocket-status'],
    environment: {
      retell_api_key: hasKey ? 'configured' : 'missing',
      retell_agent_id: hasAgent ? 'configured' : 'missing',
      agent_preview: hasAgent ? process.env.RETELL_AGENT_ID.substring(0, 10) + '...' : 'not set',
      key_preview: hasKey ? process.env.RETELL_API_KEY.substring(0, 8) + '...' : 'not set'
    },
    active_method: 'Method 3 - TTS Test',
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to test Retell API
app.get('/test-retell', async (req, res) => {
  try {
    const options = {
      hostname: 'api.retellai.com',
      path: '/v2/list-agents',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.RETELL_API_KEY}`
      }
    };

    https.get(options, (response) => {
      let body = '';
      response.on('data', (chunk) => body += chunk);
      response.on('end', () => {
        try {
          const agents = JSON.parse(body);
          res.json({ 
            success: true, 
            api_working: true,
            agents_found: agents.length || 0,
            configured_agent_found: agents.some(a => a.agent_id === process.env.RETELL_AGENT_ID)
          });
        } catch (e) {
          res.json({ success: false, error: 'Failed to parse response', body });
        }
      });
    }).on('error', (error) => {
      res.json({ success: false, error: error.message });
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Log all unmatched requests for debugging
app.use((req, res, next) => {
  logger.info(`Unmatched request: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Route not found' });
});

// Load WebSocket routes for inbound calls
require('./lib/routes')({logger, makeService});

// Start server
server.listen(port, () => {
  logger.info(`Server listening at http://localhost:${port}`);
  logger.info('Webhook endpoints ready:');
  logger.info('  - POST /outbound-call (handles answered calls)');
  logger.info('  - POST /call-status (tracks call status)');
  logger.info('  - GET / (health check)');
  logger.info('  - GET /test-retell (test Retell API connection)');
  logger.info('Current active method: Method 3 - TTS Test');
});
