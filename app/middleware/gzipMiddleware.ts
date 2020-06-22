import { Context, EggAppConfig } from 'egg';
import * as zlib from 'zlib';

export default function gzipMiddleware(options: EggAppConfig['gzipMiddleware']): any {
  return async (ctx: Context, next: () => Promise<any>) => {
    await next();

    // 后续中间件执行完成后将响应体转换成 gzip
    let body = ctx.body;

    // ctx.logger.warn(ctx.body)
    if (!body) return;

    if (options.threshold && ctx.length < options.threshold) return;

    if (ctx.isJSON(body)) body = JSON.stringify(body);

    // 设置 gzip body，修正响应头
    const stream = zlib.createGzip();
    stream.end(body);
    ctx.body = stream;
    ctx.set('Content-Encoding', 'gzip');
  };
}