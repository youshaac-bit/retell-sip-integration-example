const express = require('express');
const router = express.Router();

// Handle outbound call when answered
router.post('/outbound-call', async (req, res) => {
  console.log('Outbound call answered:', JSON.stringify(req.body, null, 2));
  
  const { call_sid, call_status, direction } = req.body;
  
  if (call_status === 'in-progress' || call_status === 'early-media') {
    console.log('Connecting to Retell WebSocket...');
    
    // Return Jambonz verbs to connect to Retell
    res.json([
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
        timeout: 3600,
        listen: {
          enable: true,
          url: `https://${req.get('host')}/webhooks/websocket-status`,
          method: "POST"
        }
      }
    ]);
  } else {
    console.log(`Call status: ${call_status}, not ready`);
    res.json([]);
  }
});

// Handle call status updates
router.post('/call-status', (req, res) => {
  console.log('Call status:', req.body.call_status);
  res.sendStatus(200);
});

// Handle websocket status
router.post('/websocket-status', (req, res) => {
  console.log('WebSocket status:', req.body);
  res.sendStatus(200);
});

// Health check
router.get('/', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'Retell webhook endpoints active'
  });
});

module.exports = router;
