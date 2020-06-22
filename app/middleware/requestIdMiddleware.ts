/**
 * 设置自定义请求头 x-request-id
 * 使用 requestId 唯一标识每个请求,标记每次请求全链路日志
 * 通过把 X-Request-Id (X-Session-Id) 标记在请求头中，在整个链路进行传递
 */
import { Context } from 'egg';
import * as uuid from 'uuid';

export default function requestIdMiddleware(): any {
  return async (ctx: Context, next: () => Promise<any>) => {
    const requestId = ctx.header['x-request-id'] || uuid();
    ctx.res.setHeader('requestId', requestId);
    ctx.requestId = requestId;
    await next();
  };
}