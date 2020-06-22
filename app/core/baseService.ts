import { Service } from 'egg';

export default class BaseService extends Service {
  protected rootUrl: string;

  public notFound(msg = 'not found') {
    this.ctx.throw(404, msg);
  }

  /**
   * 统一的响应结果检查函数
   * @memberof BaseService
   */
  checkSuccess(result) {
    if (result.status !== 200) {
      const errorMsg = result.data && result.data.error_msg ? result.data.error_msg : 'unknown error';
      this.ctx.throw(result.status, errorMsg);
    }
    if (!result.data.success) {
      // 远程调用返回格式错误
      this.ctx.throw(500, 'remote response error', { data: result.data });
    }
  }
}
