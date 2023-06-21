const express = require('express')
const convertController = require('../controllers/convertController')
const routes = express()
routes.post('/', convertController.htmltopdf)

module.exports = routes
