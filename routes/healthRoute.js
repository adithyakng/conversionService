const express = require('express')
const healthController = require('../controllers/healthController')
const routes = express()
routes.get('/', healthController.index)
module.exports = routes
