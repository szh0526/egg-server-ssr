// This file is created by egg-ts-helper@1.25.8
// Do not modify this file!!!!!!!!!

import 'egg';
import ExportApiIndexApiController from '../../../app/controller/api/indexApiController';
import ExportApiNewsApiController from '../../../app/controller/api/newsApiController';
import ExportPageHomeController from '../../../app/controller/page/homeController';
import ExportPageNewsController from '../../../app/controller/page/newsController';

declare module 'egg' {
  interface IController {
    api: {
      indexApiController: ExportApiIndexApiController;
      newsApiController: ExportApiNewsApiController;
    }
    page: {
      homeController: ExportPageHomeController;
      newsController: ExportPageNewsController;
    }
  }
}
