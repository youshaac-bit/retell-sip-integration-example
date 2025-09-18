const express = require('express');
const endpoints = require('../endpoints');  // Go up one level, then into endpoints
const routes = express.Router();

routes.use('/', endpoints);

module.exports = routes;
