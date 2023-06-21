const healthController = {}
healthController.index = (req, res) => {
  return res.json({
    status: 'Success',
    message: 'Service is healthy'
  })
}

module.exports = healthController
