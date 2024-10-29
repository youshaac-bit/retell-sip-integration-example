const assert = require('assert');
assert.ok(process.env.RETELL_API_KEY, 'You must define the RETELL_API_KEY env variable');
assert.ok(process.env.RETELL_AGENT_ID, 'You must define the RETELL_AGENT_ID env variable');
assert.ok(process.env.JAMBONZ_ACCOUNT_SID, 'You must define the JAMBONZ_ACCOUNT_SID env variable');
assert.ok(process.env.JAMBONZ_API_KEY, 'You must define the JAMBONZ_API_KEY env variable');
assert.ok(process.env.JAMBONZ_REST_API_BASE_URL, 'You must define the JAMBONZ_REST_API_BASE_URL env variable');

const express = require('express');
const app = express();
const opts = Object.assign({
  timestamp: () => `, "time": "${new Date().toISOString()}"`,
  level: process.env.LOGLEVEL || 'debug'
});
const logger = require('pino')(opts);
const port = process.env.HTTP_PORT || 3000;
const routes = require('./lib/routes');
const {Retell} = require('retell-sdk');
const retellClient = new Retell({
  apiKey: process.env.RETELL_API_KEY
});
app.locals = {
  ...app.locals,
  logger,
  client: require('@jambonz/node-client')(process.env.JAMBONZ_ACCOUNT_SID, process.env.JAMBONZ_API_KEY, {
    baseUrl: process.env.JAMBONZ_REST_API_BASE_URL
  }),
  callsInProgress: new Map(),
  retellClient
};

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/', routes);

app.listen(port, () => {
  logger.info(`Example jambonz app listening at http://localhost:${port}`);
});
