const express = require('express')
const multer = require('multer')
const upload = multer()
const convertController = require('../controllers/convertController')
const routes = express()
routes.post('/htmlToPdf', convertController.htmltopdf)
routes.post('/docxToHtml', upload.single('file'), convertController.docxToHtml)

module.exports = routes
