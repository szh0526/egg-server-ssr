import { Application } from 'egg';

export default (app: Application) => {
  const { controller: { page: { newsController } }, router } = app;
  router.get('/news/index', newsController.index);
  router.get('/news/:id', newsController.list);
};
