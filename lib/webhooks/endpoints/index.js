const router = require('express').Router();

router.use('/agent-events', require('./agent-events'));

module.exports = router;