import { Context, EggAppConfig } from 'egg';
import * as fs from 'fs';
import * as path from 'path';

export default function notfoundMiddleware(options: EggAppConfig['notfoundMiddleware']): any {
  return async (ctx: Context, next: () => Promise<any>) => {
    await next();
    if (ctx.status === 404 && !ctx.body) {
      if (ctx.acceptJSON) {
        ctx.body = { error: 'Not Found' };
      } else {
        // 同步读取404页面
        const html = fs.readFileSync(path.join(options.baseDir, options.pageUrl), 'utf-8');
        ctx.body = html;
      }
    }
  };
}