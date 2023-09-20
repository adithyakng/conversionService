require('dotenv').config()
const puppeteer = require('puppeteer')
const uuid = require('uuid')
const { PDFDocument } = require('pdf-lib')
const fs = require('fs')
const qpdf = require('node-qpdf')
const sharp = require('sharp')
const { toHtml } = require('./libreOfficeHelper')
const path = require('path')

function sendMessage (status = 1, message = 'something went wrong') {
  return {
    status,
    message
  }
}

async function convertHTMLtoPDF (html, outputFileName) {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  // Read the HTML file
  const htmlContent = html

  await page.setContent(htmlContent)

  // Generate PDF
  await page.pdf({
    path: `${outputFileName}.pdf`,
    format: 'A4',
    margin: {
      top: '100px',
      bottom: '100px'
    }
  })

  await browser.close()
}

function getUniqueID () {
  const uuid1 = uuid.v4()
  const uuid2 = uuid.v4()
  return uuid1 + '_' + Date.now() + '_' + uuid2
}

async function addHeaderFooterMetaData (pdfFilePath, header, footer, watermark, title, author) {
  try {
    // Read the existing PDF file
    const pdfBytes = fs.readFileSync(`${pdfFilePath}.pdf`)

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
        const headerImageDims = headerImage.scale(0.5)
        page.drawImage(headerImage, {
          x: 10,
          y: page.getHeight() - headerImageDims.height + 50,
          width: page.getWidth() - 100,
          height: 50
        })
      }

      // Add the footer image to the bottom center
      if (footer) {
        const footerImageDims = footerImage.scale(0.5)
        page.drawImage(footerImage, {
          x: page.getWidth() / 2 - footerImageDims.width / 2,
          y: 10,
          width: footerImageDims.width,
          height: footerImageDims.height
        })
      }
      if (watermark) {
        const watermarkImageDims = watermarkImage.scale(0.5)
        page.drawImage(watermarkImage, {
          x: page.getWidth() / 2 - watermarkImageDims.width / 2,
          y: page.getHeight() / 2 - watermarkImageDims.height / 2,
          width: watermarkImageDims.width,
          height: watermarkImageDims.height,
          opacity: 0.5
        })
      }
    }

    // Set the PDF meta data

    // Producer needs to be given so the names of underlying packages used are not exposed
    pdfDoc.setProducer('Darwinbox PDF Generator😃')

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
    return sendMessage(0, error)
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
    return sendMessage(0, error)
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

async function convertDocxToHtml (file, folderPath, fileName, req, res) {
  // Ensure that before the function is called file is present.
  // Write file to the folder with the fileName
  file.originalname = file.originalname.replace(/[/\\?%*:|"<> ]/g, '-')
  const inputFilePath = `${folderPath}/${fileName}_input_${file.originalname}`

  fs.writeFileSync(path.join(__dirname, inputFilePath), file.buffer)
  if (!fs.existsSync(path.join(__dirname, inputFilePath))) {
    await cleanUp(path.join(__dirname, folderPath))
    return res.json({
      status: 0,
      error: 'Unable to save file to disk'
    })
  }

  // Now file is saved on the disk. Now convert it to html using libreoffice
  await toHtml(path.join(__dirname, inputFilePath), path.join(__dirname, folderPath), req, res, `${fileName}_input_${file.originalname}`.replace(/\.[^/.]+$/, ''), folderPath)
}

module.exports = {
  sendMessage,
  convertHTMLtoPDF,
  getUniqueID,
  addHeaderFooterMetaData,
  encryptPdf,
  convertPdfToBase64,
  cleanUp,
  convertDocxToHtml
}
