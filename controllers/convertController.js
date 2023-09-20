const { mkdir } = require('fs/promises')
const helpers = require('../helpers')
const fs = require('fs')
const path = require('path')

const convertController = {}
convertController.htmltopdf = async (req, res) => {
  const html = req.body.html
  if (!html) {
    return res.json(helpers.sendMessage(0, 'html is missing'))
  }
  // First create a folder with a unique name
  const folderName = './files/' + helpers.getUniqueID()
  const fileName = helpers.getUniqueID()
  await mkdir(folderName)
  helpers.addDefaultMargins(req)
  // convert the html content to pdf
  await helpers.convertHTMLtoPDF(html, `${folderName}/${fileName}`, req)

  // Check if the pdf is generated
  if (!fs.existsSync(`${folderName}/${fileName}.pdf`)) {
    await helpers.cleanUp(folderName)
    return res.json(helpers.sendMessage(0, 'PDF not generated'))
  }

  // Now add the header footer and other pdf metadata
  const result = await helpers.addHeaderFooterMetaData(`${folderName}/${fileName}`, req)
  if (!result.status) {
    await helpers.cleanUp(folderName)
    return res.json(result)
  }

  if (!fs.existsSync(result.message)) {
    await helpers.cleanUp(folderName)
    return res.json(helpers.sendMessage(1, 'Error occured while adding pdf metadata'))
  }
  let outputFileName = result.message

  // Now check if we require password protection
  if (req.body.password) {
    outputFileName = folderName + '/' + helpers.getUniqueID() + '.pdf'
    const encrypedResponse = await helpers.encryptPdf(req.body.password, result.message, outputFileName)
    if (!encrypedResponse.status || !fs.existsSync(outputFileName)) {
      return res.json(helpers.sendMessage(1, encrypedResponse.message))
    }
  }

  // returnType 0 or undefined means return base64 encoded pdf
  if (!req.body.returnType) {
    const base64String = helpers.convertPdfToBase64(outputFileName)
    await helpers.cleanUp(folderName)
    return res.json({
      status: 1,
      pdf: base64String
    })
  }

  // All other returnType will stream pdf
  const file = fs.createReadStream(outputFileName)
  const stat = fs.statSync(outputFileName)
  res.setHeader('Content-Length', stat.size)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', 'attachment; filename=output.pdf')
  file.pipe(res)
  await helpers.cleanUp(folderName)
}

convertController.docxToHtml = async (req, res) => {
  const file = req.file
  if (!file) {
    return res.json(helpers.sendMessage(0, 'Please upload a file'))
  }
  if (file.mimetype !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return res.json(helpers.sendMessage(0, 'Please upload a docx file'))
  }
  // First create a folder with a unique name
  const folderName = '/files/' + helpers.getUniqueID()
  const fileName = helpers.getUniqueID()
  await mkdir(path.join(__dirname, '..', folderName))

  // convert the docx content to html
  await helpers.convertDocxToHtml(file, folderName, fileName, req, res)
}

module.exports = convertController
