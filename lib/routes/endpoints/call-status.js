const router = require('express').Router();

router.post('/', (req, res) => {
  const {logger, callsInProgress} = req.app.locals;
  const payload = req.body;
  logger.info({payload}, 'call status');
  res.sendStatus(200);

  if (payload.call_status === 'completed') {
    const {call_sid} = payload;
    const retell_call_id = callsInProgress.get(call_sid);
    callsInProgress.delete(call_sid);
    logger.info({call_sid, retell_call_id}, 
      `call completed, there are now ${callsInProgress.size} calls in progress`);
  }
});

module.exports = router;
