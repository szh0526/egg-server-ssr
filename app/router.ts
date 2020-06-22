import { Application } from 'egg';
import homeRouter from './router/page/homeRouter';
import newsRouter from './router/page/newsRouter';

import newsApiRouter from './router/api/newsApiRouter';
import indexApiRouter from './router/api/indexApiRouter';

export default (app: Application) => {
  // 页面路由
  homeRouter(app);
  newsRouter(app);

  // 接口路由
  indexApiRouter(app);
  newsApiRouter(app);
};
