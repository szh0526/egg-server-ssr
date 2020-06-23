import Controller from '../../core/baseController';

export default class NewsController extends Controller {
  public async list() {
    const ctx = this.ctx;
    try {
      // const page = ctx.query.page || 1;
      // const newsList = await ctx.service.newsService.list(page);
      // const items = newsList;
      // if (ctx.params.id) {
      //   items.filter(x => {
      //     return x.id === ctx.params.id;
      //   });
      // }
  
      // this.logger.warn('当前列表: $j', items);

      // console.log(newsList);
      await ctx.render('news/list.tpl', { list: [{
        time: 1592903915,
        title:'Fujitsu’s Fugaku and A64FX Take Arm to the Top with 415 PetaFLOPs',
        url:'https://www.anandtech.com/show/15869/new-1-supercomputer-fujitsus-fugaku-and-a64fx-take-arm-to-the-top-with-415-petaflops',
      }] });
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
      // ctx.validate({
      //   page: { type: 'number' },
      //   pageSize: { type: 'number' },
      //   id: { type: 'string' },
      //   orders: { type: 'array' },
      //   columns: { type: 'array' },
      // });

      const res = await ctx.service.newsService.list2(params);

      console.log(res);
      await ctx.render('news/list.tpl', { list: res });
    } catch (error) {
      ctx.logger.error(error.errors);
      ctx.body = { success: false };
      return;
    }
  }
}
