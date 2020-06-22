import { Context } from 'egg';

export default function reportMiddleware(): any {
  return async (ctx: Context, next: () => Promise<any>) => {
    const startTime = Date.now();
    
    await next();
    // 上报请求时间
    ctx.logger.info("请求响应时长", Date.now() - startTime);
  };
}