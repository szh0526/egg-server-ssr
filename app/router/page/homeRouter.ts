import { Application } from 'egg';

export default (app: Application) => {
  const { controller: { page: { homeController } }, router } = app;
  router.get('/', homeController.index);
  router.get('/isIOS', homeController.isIOS);
};
