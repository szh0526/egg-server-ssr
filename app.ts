/**
 * 初始化
*/
import { Application, IBoot } from 'egg';

export default class AppBoot implements IBoot {
  private readonly app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  /**
   * 此时 config 文件已经被读取并合并，但是还并未生效， 这是应用层修改配置的最后时机
   * @memberof AppBoot
   */
  configWillLoad() {
    this.app.config.coreMiddleware.unshift('requestIdMiddleware');
    this.app.config.coreMiddleware.unshift('reportMiddleware');
    return;
  }

  /**
   * 所有的配置已经加载完毕
   * @memberof AppBoot
   */
  configDidLoad() {
    return;
  }

  /**
   * 所有的配置已经加载完毕，可以用来加载应用自定义的文件，启动自定义的服务
   * @memberof AppBoot
   */
  async didLoad() {
    return;
  }

  /**
   * 所有的插件都已启动完毕，但是应用整体还未 ready，可以做一些数据初始化等操作，这些操作成功才会启动应用
   * @memberof AppBoot
   */
  async willReady() {
    return;
  }

  /**
   * 应用已经启动完毕（worker 准备就绪）
   * @memberof AppBoot
   */
  async didReady() {
    await this.app.runSchedule('loggerSchedule');
  }

  /**
   * 应用启动完成
   * @memberof AppBoot
   */
  async serverDidReady() {
    const start = Date.now();
    const app = this.app;
    const { cluster: { listen: { port } }, env, name } = app.config;
    const { title, versions: { node }, pid, execPath } = process;
    // const ctx = app.createAnonymousContext(); // 创建一个新的执行上下文
    
    app.messenger.on('agent_start_action', data => {
      app.logger.info('agent进程是否已启动', data.success)
    });

    // app.httpclient.on('request', request => {
    //   // 可以在这里设置一些 trace headers，方便全链路跟踪
    //   app.logger.info('request %j',request.url);
    // })
    // app.httpclient.on('response', response => {
    //   // 可以在这里设置一些 trace headers，方便全链路跟踪
    //   app.logger.info('response %j',response.res.timing);
    // })

    app.on('error', (err) => {
      app.logger.error(err);
    });

    // app.on('request', ctx => {
    //   // log receive request
    //   console.log('request');
    // }); 

    // app.on('response', ctx => {
    //   // ctx.starttime is set by framework
    //   const used = Date.now() - ctx.starttime;
    //   // log total cost
    //   console.log('used', used);
    // });

    // app.logger.info(app.config.httpclient);

    app.logger.info(
      `\r\n-----------------「应用已启动」----------------------\r\n
        应用名称:${name}
        启动端口号:${port}
        node进程名称:${title}
        node版本:${node}
        node进程id:${pid}
        node进程执行路径:${execPath}
        环境变量:${env}
        启动耗时:${Date.now() - start}毫秒
      \r\n-----------------「应用已启动」----------------------\r\n`);
  }

  /**
   * 应用即将关闭
   * @memberof AppBoot
   */
  async beforeClose() {
    this.app.logger.warn('应用即将关闭');
  }
}
