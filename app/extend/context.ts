/**
 * Context 请求上下文扩展
 */
const LOGGER = Symbol('Context#CustomLogger');
const { AppLogger } = require('egg-customer-format-logger');

export default {
  get logger() { 
    if (!this[LOGGER]) {
      this[LOGGER] = AppLogger(this);
    }
    return this[LOGGER];
  },
  get isIOS() {
    const iosReg = /iphone|ipad|ipod/i;
    return iosReg.test('');
  },
  isJSON(body) {
    if (!body) return false;
    if (typeof body === 'string') return false;
    if (typeof body.pipe === 'function') return false;
    if (Buffer.isBuffer(body)) return false;
    return true;
  },
};
