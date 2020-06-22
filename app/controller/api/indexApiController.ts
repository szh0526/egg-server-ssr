import Controller from '../../core/baseController';

export default class IndexApiController extends Controller {

  public async settingLanguage(): Promise<void> {
    this.ctx.body = {
      success: true
    };
  }
}
