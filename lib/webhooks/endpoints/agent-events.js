const router = require('express').Router();

router.post('/', (req, res) => {
  const {logger} = req.app.locals;
  const payload = req.body;
  logger.info({payload}, 'agent event');
  res.sendStatus(200);
});

module.exports = router;
