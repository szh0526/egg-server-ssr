import Controller from '../../core/baseController';

export default class NewsController extends Controller {
  public async list() {
    const ctx = this.ctx;
    try {
      const page = ctx.query.page || 1;
      const newsList = await ctx.service.newsService.list(page);
      const items = newsList;
      if (ctx.params.id) {
        items.filter(x => {
          return x.id === ctx.params.id;
        });
      }
  
      this.logger.info(ctx.helper.relativeTime(new Date()))
  
      // this.logger.warn('当前列表: $j', items);
      await ctx.render('news/list.tpl', { list: items });
    } catch (error) {
      ctx.logger.error(error.errors);
      ctx.body = { success: false };
      return;
    }
  }

  public async index() {
    const ctx = this.ctx;
    try {
      const params = {
        page: ctx.query.page || 1,
        pageSize: ctx.query.pageSize || 10,
        id: ctx.query.id,
        orders: [[ 'id', 'desc' ]],
        columns: [ 'id', 'name', 'password', 'age' ],
      };
      console.log(params);
      ctx.validate({
        page: { type: 'number' },
        pageSize: { type: 'number' },
        id: { type: 'string' },
        orders: { type: 'array' },
        columns: { type: 'array' },
      });


      const res = await ctx.service.newsService.list2(params);
      await ctx.render('user-list.tpl', { list: res });
    } catch (error) {
      ctx.logger.error(error.errors);
      ctx.body = { success: false };
      return;
    }
  }
}
