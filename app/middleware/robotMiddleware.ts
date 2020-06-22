import { Context, EggAppConfig } from 'egg';

export default (options: EggAppConfig['robotMiddleware']): any => {
  return async function robotMiddleware(ctx: Context, next: any) {
    const source = ctx.get('user-agent') || '';
    const match = options.ua.some(ua => ua.test(source));
    if (match) {
      ctx.status = 403;
      ctx.message = 'Go away, robot.';
    } else {
      await next();
    }
  };
};
