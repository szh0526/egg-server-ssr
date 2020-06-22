import Controller from '../../core/baseController';

export default class HomeController extends Controller {
  public async index() {
    const { ctx } = this;
    try {
      ctx.body = await ctx.service.testService.sayHi(`${this.user},${ctx.__('OK')}`);
      ctx.logger.error(new Error('测试'));
      ctx.logger.debug('测试');
      ctx.logger.info('测试');
    } catch (error) {
      ctx.logger.error(error.errors);
      ctx.body = { success: false };
      return;
    }
  }

  public async isIOS() {
    const { ctx } = this;
    ctx.body = `isIOS: ${ctx.isIOS},${ctx.query.lang}`;
  }
}
