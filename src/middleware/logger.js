function requestLogger(req, _res, next) {
  const started = Date.now();
  req.logAction = (action, details = {}) => {
    const payload = {
      at: new Date().toISOString(),
      ip: req.ip,
      method: req.method,
      path: req.originalUrl,
      action,
      details,
      elapsedMs: Date.now() - started,
    };
    console.log(JSON.stringify(payload));
  };
  next();
}

module.exports = {
  requestLogger,
};
