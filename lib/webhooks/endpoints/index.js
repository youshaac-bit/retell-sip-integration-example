const router = require('express').Router();

router.use('/agent-events', require('./agent-events'));
router.use('/inbound-webhook', require('./inbound-webhook'));

module.exports = router;
