import Controller from '../../core/baseController';

export default class NewsApiController extends Controller {
  public async index(): Promise<void> {
    const { ctx } = this;
    const start = Date.now();
    ctx.body = {
      name: 'egg',
      category: 'framework',
      language: 'Node.js',
    };
    const used = Date.now() - start;
    ctx.set('show-response-time', used.toString());
  }

  public async getHtml(): Promise<void> {
    this.ctx.throw(500, '故意出错')
    // this.ctx.redirect('/news/list');
  }
}
