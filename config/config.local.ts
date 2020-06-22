/**
 * 本地开发环境配置
*/
import { EggAppConfig, PowerPartial } from 'egg';

export default () => {
  const config: PowerPartial<EggAppConfig> = {
    httpclient: {
      request: {
        // 默认 request 超时时间
        timeout: 5000,
        // 对 HttpClient 的请求进行抓包调试
        enableProxy: true,
        rejectUnauthorized: false,
        // 代理服务器
        proxy: process.env.http_proxy,
      },
    }
  };
  return config;
};
