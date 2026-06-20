function notFoundHandler(req, res) {
  res.status(404).render('404', { path: req.originalUrl })
}

function errorHandler(err, req, res, next) {
  console.error(err)
  res.status(500).render('500', { error: err.message || 'Lỗi máy chủ nội bộ' })
}

module.exports = {
  notFoundHandler,
  errorHandler
}
