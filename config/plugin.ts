import { EggPlugin } from 'egg';

const plugin: EggPlugin = {
  // static: true,
  nunjucks: {
    enable: true,
    package: 'egg-view-nunjucks',
  },
  validate: {
    enable: true,
    package: 'egg-validate',
  },
  customerLogger: {
    enable: true,
    // npm 模块名称，通过 npm 模块形式引入插件
    package: 'egg-customer-format-logger',
    // 插件绝对路径，跟 package 配置互斥 调试插件时使用此配置
    // path: '/Users/sunzehao3/Documents/demo/egg-customer-format-logger',
  }
};

export default plugin;
