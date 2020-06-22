/**
 * 生产环境配置
*/
import { EggAppConfig, PowerPartial } from 'egg';

export default () => {
  const config: PowerPartial<EggAppConfig> = {
    cluster: {
      listen: {
        path: '',
        port: 7002,
        hostname: 'egg-server-ssr.test.com'
      },
    },
  };
  return config;
};
