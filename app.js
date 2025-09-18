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

// Helper function to create Retell phone call
async function createRetellPhoneCall(callData) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      agent_id: process.env.RETELL_AGENT_ID,
      from_number: callData.from,
      to_number: callData.to,
      direction: "outbound",
      retell_llm_dynamic_variables: {
        call_sid: callData.call_sid
      }
    });

    const options = {
      hostname: 'api.retellai.com',
      path: '/v2/create-phone-call',
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
          logger.info({result}, 'Retell create call response');
          resolve(result);
        } catch (e) {
          logger.error({error: e, body}, 'Failed to parse Retell response');
          reject(e);
        }
      });
    });

    req.on('error', (error) => {
      logger.error({error}, 'Retell API request failed');
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
}

// WEBHOOK ROUTE - Handle outbound calls
app.post('/outbound-call', async (req, res) => {
  logger.info('=== OUTBOUND CALL WEBHOOK TRIGGERED ===');
  logger.info({body: req.body}, 'Call details received');
  
  const { call_sid, call_status, from, to, sip_status } = req.body;
  
  if (call_status === 'in-progress') {
    logger.info('Call answered, connecting to Retell AI...');
    
    try {
      // METHOD 1: Direct WebSocket connection to Retell
      const response = [
        {
          verb: "connect",
          url: "wss://api.retellai.com/v1/websocket",
          method: "websocket",
          headers: {
            "Authorization": `Bearer ${process.env.RETELL_API_KEY}`,
            "Content-Type": "application/json",
            "x-agent-id": process.env.RETELL_AGENT_ID
          }
        }
      ];
      
      logger.info('Sending WebSocket connect to Retell');
      logger.info({response: JSON.stringify(response)}, 'Connect verb');
      res.json(response);
      
    } catch (error) {
      logger.error({error}, 'Failed to connect to Retell');
      res.json([{
        verb: "say",
        text: "Sorry, there was a technical error.",
        synthesizer: {
          vendor: "elevenlabs",  // Using the configured TTS
          voice: "Xb7hH8MSUJpSbSDYk0k2"
        }
      }]);
    }
    
  } else if (call_status === 'early-media') {
    // Handle early media state
    logger.info('Call in early-media state, waiting...');
    res.json([]);
  } else {
    logger.info(`Call status: ${call_status} - no action`);
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
  
  // Log WebSocket connection failures
  if (call_status === 'completed' && duration < 2) {
    logger.warn('Call ended quickly - possible WebSocket connection failure');
  }
  
  res.sendStatus(200);
});

// WebSocket status endpoint
app.post('/websocket-status', (req, res) => {
  logger.info({body: req.body}, 'WebSocket status from Jambonz');
  res.sendStatus(200);
});

// Health check endpoint
app.get('/', (req, res) => {
  const hasKey = !!process.env.RETELL_API_KEY;
  const hasAgent = !!process.env.RETELL_AGENT_ID;
  
  res.json({ 
    status: 'running',
    message: 'Retell-Jambonz Integration Active',
    method: 'Direct WebSocket Connection',
    endpoints: ['/outbound-call', '/call-status', '/websocket-status'],
    environment: {
      retell_api_key: hasKey ? 'configured' : 'missing',
      retell_agent_id: hasAgent ? 'configured' : 'missing',
      agent_preview: hasAgent ? process.env.RETELL_AGENT_ID.substring(0, 20) + '...' : 'not set'
    },
    timestamp: new Date().toISOString()
  });
});

// Test Retell API
app.get('/test-retell', async (req, res) => {
  try {
    // First test: List agents
    const options = {
      hostname: 'api.retellai.com',
      path: '/list-agents',
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
              error: data.error
            });
          } else {
            const agents = Array.isArray(data) ? data : (data.agents || []);
            const uniqueAgents = [...new Set(agents.map(a => a.agent_id || a.id))];
            
            res.json({ 
              success: true, 
              api_working: true,
              unique_agents: uniqueAgents.length,
              configured_agent_found: uniqueAgents.includes(process.env.RETELL_AGENT_ID),
              configured_agent_id: process.env.RETELL_AGENT_ID
            });
          }
        } catch (e) {
          res.json({ 
            success: false, 
            error: 'Parse error',
            details: e.message
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

// Log unmatched requests
app.use((req, res, next) => {
  logger.info(`Unmatched: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Route not found' });
});

// Load WebSocket routes for inbound calls
require('./lib/routes')({logger, makeService});

// Start server
server.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  logger.info(`Retell Agent ID: ${process.env.RETELL_AGENT_ID}`);
  logger.info('Ready for outbound calls');
});
