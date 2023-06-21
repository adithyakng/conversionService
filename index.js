require('dotenv').config()
const cors = require('cors')
const express = require('express')
const bodyParser = require('body-parser')

const healthRoute = require('./routes/healthRoute')
const convertRoute = require('./routes/convertRoute')

const app = express()
app.use(cors())

app.use(bodyParser.json({ limit: '1000mb' }))
app.use(
  bodyParser.urlencoded({
    limit: '1000mb',
    extended: true,
    parameterLimit: 500000
  })
)

app.use('/health', healthRoute)
app.use('/convert', convertRoute)

app.listen(process.env.PORT, () => {
  console.log(`Server Started at port ${process.env.PORT}`)
})
