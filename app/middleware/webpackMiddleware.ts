import { Context, EggAppConfig } from 'egg';

export default function webpackMiddleware(options: EggAppConfig['webpackMiddleware']): any {
  return async (ctx: Context, next: () => Promise<any>) => {
    await next();

    console.log(options.enable, ctx.app.config.env);

  };
}