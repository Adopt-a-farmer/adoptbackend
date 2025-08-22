const logger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || '';

  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip} - ${userAgent}`);

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(data) {
    const statusCode = res.statusCode;
    const responseTime = Date.now() - req.startTime;
    
    console.log(`[${timestamp}] Response: ${statusCode} - ${responseTime}ms`);
    
    if (statusCode >= 400) {
      console.error(`[ERROR] ${method} ${url} - ${statusCode}: ${JSON.stringify(data)}`);
    }
    
    return originalJson.call(this, data);
  };

  req.startTime = Date.now();
  next();
};

module.exports = { logger };