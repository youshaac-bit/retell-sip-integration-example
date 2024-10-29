const router = require('express').Router();
const WebhookResponse = require('@jambonz/node-client').WebhookResponse;

router.post('/', async(req, res) => {
  const {logger, callsInProgress, retellClient} = req.app.locals;
  const {registerCall} = require('../../../lib/utils/retell')(logger, retellClient);
  logger.info({payload: req.body}, 'POST /retellai');
  const opts = {
    agent_id: process.env.RETELL_AGENT_ID,
    from: req.body.from,
    to: req.body.to,
    direction: req.body.direction,
    call_sid: req.body.call_sid
  }
  try {
    logger.info({opts}, 'opts');
    const retell_call_id = await registerCall(opts);
    logger.info({retell_call_id}, 'Call registered');
    callsInProgress.set(req.body.call_sid, {retell_call_id});
    logger.info(`there are now ${callsInProgress.size} calls in progress`);
    const app = new WebhookResponse();
    app
      .answer()
      .dial({
        callerId: req.body.from,
        answerOnBridge: true,
        target: [
          {
            type: 'sip',
            sipUri: `sip:${retell_call_id}@5t4n6j0wnrl.sip.livekit.cloud`
          }
        ]
      });
    res.status(200).json(app);
  } catch (err) {
    logger.error({err}, 'Error');
    res.sendStatus(503);
  }
});

module.exports = router;
