require('dotenv').config()
const puppeteer = require('puppeteer')
const uuid = require('uuid')
const { PDFDocument } = require('pdf-lib')
const fs = require('fs')
const qpdf = require('node-qpdf')
const sharp = require('sharp')

const gapSize = 0.75

function sendMessage (status = 1, message = 'something went wrong') {
  return {
    status,
    message
  }
}

async function convertHTMLtoPDF (html, outputFileName, req) {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  const header = req.body.header
  const footer = req.body.footer

  let top = req.body.margins.top
  let bottom = req.body.margins.bottom

  if (header) {
    top = req.body.margins.top + (req.body.headerHeight ? req.body.headerHeight : 100) + (gapSize * (req.body.headerHeight ? req.body.headerHeight : 100)) // ( gapSize is used for getting space between header and the content)
  }
  if (footer) {
    bottom = req.body.margins.bottom + (req.body.footerHeight ? req.body.footerHeight : 100) + (gapSize * (req.body.footerHeight ? req.body.footerHeight : 100))
  }
  const margins =
     {
       top: `${top}px`,
       bottom: `${bottom}px`,
       left: `${req.body.margins.left}px`,
       right: `${req.body.margins.right}px`
     }
  // Read the HTML file
  const htmlContent = html
  await page.setContent(htmlContent, { waitUntil: ['load', 'networkidle0'] })

  // Generate PDF
  await page.pdf({
    path: `${outputFileName}.pdf`,
    printBackground: true,
    format: 'A4',
    margin: margins
  })

  await browser.close()
}

function getUniqueID () {
  const uuid1 = uuid.v4()
  const uuid2 = uuid.v4()
  return uuid1 + '_' + Date.now() + '_' + uuid2
}

async function addHeaderFooterMetaData (pdfFilePath, req) {
  try {
    // Read the existing PDF file
    const pdfBytes = fs.readFileSync(`${pdfFilePath}.pdf`)
    const header = req.body.header
    const footer = req.body.footer
    const watermark = req.body.watermark
    const title = req.body.title
    const author = req.body.author
    const watermarkOpacity = req.body.opacity ? req.body.opacity : 0.2

    // Create a new PDF document
    const pdfDoc = await PDFDocument.load(pdfBytes)

    // Load the header and footer images
    let headerImage
    if (header) {
      // Check for the image format
      const headerImageType = getImageFormatFromBase64(header)
      const headerImageBuffer = base64ToBuffer(header)
      const resizedHeaderImageBuffer = await sharp(headerImageBuffer).resize().toBuffer()
      // Embed the header image based on it's format
      if (!headerImageType) {
        return sendMessage(0, 'Cannot recognise header image type')
      } else if (headerImageType === 'jpg') {
        headerImage = await pdfDoc.embedJpg(resizedHeaderImageBuffer)
      } else {
        headerImage = await pdfDoc.embedPng(resizedHeaderImageBuffer)
      }
    }
    let footerImage
    if (footer) {
      // Check for the image format
      const footerImageType = getImageFormatFromBase64(footer)
      const footerImageBuffer = base64ToBuffer(footer)
      const resizedFooterImageBuffer = await sharp(footerImageBuffer).resize().toBuffer()
      // Embed the footer image based on it's format
      if (!footerImageType) {
        return sendMessage(0, 'Cannot recognise footer image type')
      } else if (footerImageType === 'jpg') {
        footerImage = await pdfDoc.embedJpg(resizedFooterImageBuffer)
      } else {
        footerImage = await pdfDoc.embedPng(resizedFooterImageBuffer)
      }
    }

    let watermarkImage
    if (watermark) {
      // Check for the image format
      const watermarkImageType = getImageFormatFromBase64(watermark)
      const watermarkImageBuffer = base64ToBuffer(watermark)
      const resizedWatermarkImageBuffer = await sharp(watermarkImageBuffer).resize().toBuffer()
      // Embed the footer image based on it's format
      if (!watermarkImageType) {
        return sendMessage(0, 'Cannot recognise watermakr image type')
      } else if (watermarkImageType === 'jpg') {
        watermarkImage = await pdfDoc.embedJpg(resizedWatermarkImageBuffer)
      } else {
        watermarkImage = await pdfDoc.embedPng(resizedWatermarkImageBuffer)
      }
    }

    // Get the number of pages in the PDF document
    const pageCount = pdfDoc.getPageCount()

    // Iterate through each page
    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.getPage(i)

      // Add the header image to the top left corner
      if (header) {
        const headerHeight = req.body.headerHeight ? req.body.headerHeight : 100
        page.drawImage(headerImage, {
          x: req.body.margins.left,
          y: page.getHeight() - headerHeight - req.body.margins.top,
          width: page.getWidth() - req.body.margins.left - req.body.margins.right,
          height: headerHeight
        })
      }

      // Add the footer image to the bottom center
      if (footer) {
        const footerHeight = req.body.footerHeight ? req.body.footerHeight : 100
        page.drawImage(footerImage, {
          x: req.body.margins.left,
          y: 0 + req.body.margins.bottom,
          width: page.getWidth() - req.body.margins.left - req.body.margins.right,
          height: footerHeight
        })
      }
      if (watermark) {
        const watermarkImageDims = watermarkImage.scale(0.5)
        page.drawImage(watermarkImage, {
          x: page.getWidth() / 2 - watermarkImageDims.width / 2,
          y: page.getHeight() / 2 - watermarkImageDims.height / 2,
          width: watermarkImageDims.width,
          height: watermarkImageDims.height,
          opacity: watermarkOpacity
        })
      }
    }

    // Set the PDF meta data

    // Producer needs to be given so the names of underlying packages used are not exposed
    pdfDoc.setProducer(req.body.producer ? req.body.producer : 'Darwinbox PDF Generator😃')

    // Set the title if present
    if (title) {
      pdfDoc.setTitle(title)
    }

    // Set the author if present
    if (author) {
      pdfDoc.setAuthor(author)
    }

    // Save the modified PDF to a new file
    const modifiedPdfBytes = await pdfDoc.save()
    fs.writeFileSync(`${pdfFilePath}_output.pdf`, modifiedPdfBytes)

    return sendMessage(1, `${pdfFilePath}_output.pdf`)
  } catch (error) {
    console.log(error)
    return sendMessage(0, error.message)
  }
}

function getImageFormatFromBase64 (base64String) {
  if (base64String.startsWith('data:image/png')) {
    return 'png'
  } else if (base64String.startsWith('data:image/jpeg') || base64String.startsWith('data:image/jpg')) {
    return 'jpg'
  }

  return null // Unknown format
}

function base64ToBuffer (base64String) {
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '')
  const bufferData = Buffer.from(base64Data, 'base64')
  return bufferData
}

async function encryptPdf (password, inputPdfFilePath, outputPdfFilePath) {
  try {
    const options = {
      keyLength: 256,
      password,
      outputFile: outputPdfFilePath,
      restrictions: {
        modify: 'none',
        extract: 'n'
      }
    }

    await qpdf.encrypt(inputPdfFilePath, options)
    return sendMessage(1, outputPdfFilePath)
  } catch (error) {
    return sendMessage(0, error.message)
  }
}

function convertPdfToBase64 (filePath) {
  // Read the PDF file
  const fileData = fs.readFileSync(filePath)

  // Convert the file data to a Base64 string
  const base64String = fileData.toString('base64')

  return base64String
}

async function cleanUp (folderPath) {
  await fs.promises.rm(folderPath, { recursive: true })
}

function addDefaultMargins (req) {
  if (!req.body.margins) {
    req.body.margins = {}
  }
  req.body.margins.top = req.body.margins.top ? req.body.margins.top : 20
  req.body.margins.bottom = req.body.margins.bottom ? req.body.margins.bottom : 20
  req.body.margins.left = req.body.margins.left ? req.body.margins.left : 20
  req.body.margins.right = req.body.margins.right ? req.body.margins.right : 20
}

module.exports = {
  sendMessage,
  convertHTMLtoPDF,
  getUniqueID,
  addHeaderFooterMetaData,
  encryptPdf,
  convertPdfToBase64,
  cleanUp,
  addDefaultMargins
}
