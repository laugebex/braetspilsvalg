const { config, json } = require('../lib/shared');
const { storageConfigured } = require('../lib/redis');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  return json(res, 200, { ...config, storageConfigured: storageConfigured() });
};
