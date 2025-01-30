const router = require('express').Router();

router.use('/agent-events', require('./agent-events'));
router.use('/inbound-webhook', require('./inbound-webhook'));
router.use('/success', require('./success'));

module.exports = router;
