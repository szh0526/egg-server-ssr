import { Controller } from 'egg';

interface ResponseJson {
  resultCode: number;
  resultMsg: string;
  resultData: any;
  errorData?: {
    code: number;
    msg: string;
  };
  actionData?: any;
}

export default class BaseController extends Controller {
  public get user() {
    return 'zehao.sun'
  }

  public defaultJson(res: ResponseJson) {
    return res;
  }

  public notFound(msg = 'not found') {
    this.ctx.throw(404, msg);
  }
}
