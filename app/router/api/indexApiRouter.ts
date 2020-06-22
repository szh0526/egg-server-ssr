import { Application } from 'egg';

export default (app: Application) => {
  const {
    controller: {
      api: {
        indexApiController
      },
    },
    router
  } = app;
  router.get('/api/index/settingLanguage', indexApiController.settingLanguage);
};
