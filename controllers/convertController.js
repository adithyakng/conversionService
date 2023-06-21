const { mkdir } = require('fs/promises')
const helpers = require('../helpers')
const fs = require('fs')

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
  // convert the html content to pdf
  await helpers.convertHTMLtoPDF(html, `${folderName}/${fileName}`)

  // Check if the pdf is generated
  if (!fs.existsSync(`${folderName}/${fileName}.pdf`)) {
    await helpers.cleanUp(folderName)
    return res.json(helpers.sendMessage(0, 'PDF not generated'))
  }

  // Now add the header footer and other pdf options
  const result = await helpers.addHeaderFooterMetaData(`${folderName}/${fileName}`, req.body.header, req.body.footer, req.body.watermark, req.body.title, req.body.author)
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
    await helpers.encryptPdf(req.body.password, result.message, outputFileName)
  }

  // returnType 0 or undefined means return base64 encoded pdf
  if (!req.body.returnType) {
    await helpers.cleanUp(folderName)
    return res.json({
      status: 1,
      pdf: helpers.convertPdfToBase64(outputFileName)
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

module.exports = convertController
