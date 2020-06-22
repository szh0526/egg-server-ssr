import { Application } from 'egg';

export default (app: Application) => {
  const {
    controller: {
      api: {
        newsApiController
      },
    },
    router
  } = app;
  router.get('/api/news/index', newsApiController.index);
  router.get('/api/news/getHtml', newsApiController.getHtml);
};
