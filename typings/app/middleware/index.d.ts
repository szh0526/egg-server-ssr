// This file is created by egg-ts-helper@1.25.8
// Do not modify this file!!!!!!!!!

import 'egg';
import ExportErrorMiddleware from '../../../app/middleware/errorMiddleware';
import ExportGzipMiddleware from '../../../app/middleware/gzipMiddleware';
import ExportNotfoundMiddleware from '../../../app/middleware/notfoundMiddleware';
import ExportReportMiddleware from '../../../app/middleware/reportMiddleware';
import ExportRequestIdMiddleware from '../../../app/middleware/requestIdMiddleware';
import ExportRobotMiddleware from '../../../app/middleware/robotMiddleware';
import ExportWebpackMiddleware from '../../../app/middleware/webpackMiddleware';

declare module 'egg' {
  interface IMiddleware {
    errorMiddleware: typeof ExportErrorMiddleware;
    gzipMiddleware: typeof ExportGzipMiddleware;
    notfoundMiddleware: typeof ExportNotfoundMiddleware;
    reportMiddleware: typeof ExportReportMiddleware;
    requestIdMiddleware: typeof ExportRequestIdMiddleware;
    robotMiddleware: typeof ExportRobotMiddleware;
    webpackMiddleware: typeof ExportWebpackMiddleware;
  }
}
