const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')
delete require.cache[require.resolve('./helpers')]
const helpers = require('./helpers')

async function toHtml (inputPath, outputPath, req, res, fileName, folderPath) {
  // First find out the OS
  let paths
  switch (process.platform) {
    case 'darwin': paths = '/Applications/LibreOffice.app/Contents/MacOS/'
      break
    case 'linux': paths = '/usr/bin/'
      break
    default:
      await helpers.cleanUp(path.join(__dirname, folderPath))
      return res.json({
        status: 0,
        message: 'Platform not yet supported'
      })
  }

  if (!fs.existsSync(`${paths}/soffice`)) {
    await helpers.cleanUp(path.join(__dirname, folderPath))
    return res.json({
      status: 0,
      message: 'LibreOffice not found.'
    })
  }

  // Now we know the path. So create the command
  const command = `soffice --headless --convert-to html:'HTML (StarWriter):EmbedImages' --outdir ${outputPath} ${inputPath}`

  try {
    childProcess.execSync(command, {
      cwd: paths
    })
  } catch (error) {
    await helpers.cleanUp(path.join(__dirname, folderPath))
    return res.json({
      status: 0,
      message: error.toString()
    })
  }

  // Now html file has been generated, check once if the file exists
  if (!fs.existsSync(path.join(outputPath, `${fileName}.html`))) {
    await helpers.cleanUp(path.join(__dirname, folderPath))
    return res.json({
      status: 0,
      message: 'Output File could not be generated.'
    })
  } else {
    // Return the file contents
    const fileContents = fs.readFileSync(path.join(outputPath, `${fileName}.html`)).toString()
    await helpers.cleanUp(path.join(__dirname, folderPath))
    return res.json({
      status: 1,
      html: fileContents
    })
  }
}

module.exports = {
  toHtml
}
