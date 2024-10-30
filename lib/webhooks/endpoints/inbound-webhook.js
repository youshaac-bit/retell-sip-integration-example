const router = require('express').Router();

router.post('/', (req, res) => {
  const {logger} = req.app.locals;
  const payload = req.body;
  logger.info({payload}, 'inbound webhook');
  res.json({
    user_name: 'John Doe',
    user_email: 'john@example.com'
  });
});

module.exports = router;
