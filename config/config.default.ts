/**
 * 默认配置，所有环境都会加载这个配置文件，
 * 当指定 env 时会同时加载对应的配置文件，并覆盖默认配置文件的同名配置 如 prod 环境会加载 config.prod.js
*/
import { EggAppConfig, EggAppInfo, PowerPartial } from 'egg';
import { join } from 'path';

export default (appInfo: EggAppInfo) => {
  const config: PowerPartial<EggAppConfig> = {
    /**
     * egg环境变量
     * @member {String} Config#env
     * @see {appInfo#env}
     * @since 1.0.0
     */
    env: appInfo.env,

    /**
     * 应用名称
     * @member {String} Config#name
     * @see {appInfo#name}
     * @since 1.0.0
     */
    name: appInfo.name,

    /**
     * package.json
     * @member {Object} Config#pkg
     * @see {appInfo#pkg}
     * @since 1.0.0
     */
    pkg: appInfo.pkg,

    /**
     * 用户目录，如 admin 账户为 /home/admin
     * @member {String} Config#HOME
     * @see {appInfo#HOME}
     * @since 1.0.0
     */
    HOME: appInfo.HOME,

    /**
     * 应用代码的目录
     * @member {String} Config#baseDir
     * @see {appInfo#baseDir}
     * @since 1.0.0
     */
    baseDir: appInfo.baseDir,

    /**
     * 应用根目录，local 和 unittest 环境为 baseDir，其他环境HOME目录。
     * @member {String} Config#root
     * @see {appInfo#root}
     * @since 1.0.0
     */
    root: appInfo.root,

    /**
     * cookie密钥
     * @member {String} Config#keys
     * @see http://eggjs.org/en/core/cookie-and-session.html#cookie-secret-key
     * @default
     * @since 1.0.0
     */
    keys: appInfo.name + '_1591154703884_5628',
    i18n: {
      // 默认语言，默认 "en-US"
      defaultLocale: 'en-US',
      // URL 参数，默认 "locale"
      queryField: 'locale',
      // Cookie 记录的 key, 默认："locale"
      cookieField: 'locale',
      // Cookie 默认 `1y` 一年后过期， 如果设置为 Number，则单位为 ms
      cookieMaxAge: 60 * 60 * 24 * 365 * 1,
    },
    // 线上环境建议部署到 CDN，无需该插件 https://www.jianshu.com/p/f1c7f3fa3998
    static: {
      // 访问静态化的url前缀,如：`http://127.0.0.1:7001/static/images/logo.png`
      prefix: '/static',
      // 需要设置静态化的目录
      dir: [
        join(appInfo.baseDir, 'app/public'),
      ],
      // 如果当前访问的静态资源没有缓存，则缓存静态文件，和`preload`配合使用；
      dynamic: true,
      preload: false,
      // 缓存30天 默认在prod环境缓存31536000秒，其他环境0秒
      maxAge: 60 * 60 * 24 * 30,
      // 是否将缓存文件保存在内存中（默认生产环境会缓存，其他环境实时读取）
      buffer: true,
      // 缓存文件的最大数量，仅在 dynamic 参数为 true 时有效，默认值为 1000
      maxFiles: 2000,
    },
    cluster: {
      listen: {
        path: '',
        port: 7001,
        hostname: '127.0.0.1',
      },
    },
    security: {
      domainWhiteList: [ 'egg.cjdfintech.com' ],
    },
    view: {
      defaultViewEngine: 'nunjucks',
      mapping: {
        '.tpl': 'nunjucks',
      },
    },
    /**
     * 日志路径配置
     * app.log 应用相关日志
     * core.log 框架内核、插件日志
     * error.log logger.error 异常日志
     * agent.log agent 进程日志
     */
    logger: {
      dir: `/var/log/egg-server-ssr`,
      // dir: join(appInfo.root, 'logs', appInfo.name),
      encoding: 'utf-8',
      env: appInfo.env,
      level: 'INFO',
      // 打印所有级别日志到终端
      consoleLevel: 'DEBUG',
      // 生产环境打印 debug 日志
      allowDebugAtProd: false,
      outputJSON: true,
      // 生产环境 关闭终端日志输出
      disableConsoleAfterReady: appInfo.env === 'prod',
      appLogName: `${appInfo.name}-app.log`,
      coreLogName: `${appInfo.name}-core.log`,
      agentLogName: `${appInfo.name}-agent.log`,
      errorLogName: `${appInfo.name}-error.log`,
    },
    // customLogger: {
    //   scheduleLogger: {
    //     consoleLevel: 'INFO',
    //     file: join(appInfo.root, 'logs', appInfo.name, 'egg-schedule.log'),
    //   },
    // },
    /**
    * The option of `bodyParser`
    * 当请求body超过解析最大长度，抛异常413 ，body解析失败（错误的json）抛异常400
    *
    * @member Config#bodyParser
    * @property {Boolean} enable - enable bodyParser or not, default is true
    * @property {String | RegExp | Function | Array} ignore - won't parse request body when url path hit ignore pattern, can not set `ignore` when `match` presented
    * @property {String | RegExp | Function | Array} match - will parse request body only when url path hit match pattern
    * @property {String} encoding - body's encoding type，default is utf8
    * @property {String} formLimit - limit of the urlencoded body. If the body ends up being larger than this limit, a 413 error code is returned. Default is 1mb
    * @property {String} jsonLimit - limit of the json body, default is 1mb
    * @property {String} textLimit - limit of the text body, default is 1mb
    * @property {Boolean} strict - when set to true, JSON parser will only accept arrays and objects. Default is true
    * @property {Number} queryString.arrayLimit - urlencoded body array's max length, default is 100
    * @property {Number} queryString.depth - urlencoded body object's max depth, default is 5
    * @property {Number} queryString.parameterLimit - urlencoded body maximum parameters, default is 1000
    */
    bodyParser: {
      enable: true,
      encoding: 'utf8',
      formLimit: '10mb',
      jsonLimit: '10mb',
      textLimit: '10mb',
      strict: true,
      // @see https://github.com/hapijs/qs/blob/master/lib/parse.js#L8 for more options
      queryString: {
        arrayLimit: 100,
        depth: 5,
        parameterLimit: 1000,
      },
    },
    /**
     * The option for httpclient
     * @member Config#httpclient
     * @property {Boolean} enableDNSCache - Enable DNS lookup from local cache or not, default is false.
     *
     * @property {Number} request.timeout - httpclient request default timeout, default is 5000 ms.
     *
     * @property {Boolean} httpAgent.keepAlive - Enable http agent keepalive or not, default is true
     * @property {Number} httpAgent.freeSocketTimeout - http agent socket keepalive max free time, default is 4000 ms.
     * @property {Number} httpAgent.maxSockets - http agent max socket number of one host, default is `Number.MAX_SAFE_INTEGER` @ses https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER
     * @property {Number} httpAgent.maxFreeSockets - http agent max free socket number of one host, default is 256.
     *
     * @property {Boolean} httpsAgent.keepAlive - Enable https agent keepalive or not, default is true
     * @property {Number} httpsAgent.freeSocketTimeout - httpss agent socket keepalive max free time, default is 4000 ms.
     * @property {Number} httpsAgent.maxSockets - https agent max socket number of one host, default is `Number.MAX_SAFE_INTEGER` @ses https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER
     * @property {Number} httpsAgent.maxFreeSockets - https agent max free socket number of one host, default is 256.
     */
    httpclient: {
      // 是否开启本地 DNS 缓存，默认关闭，开启后有两个特性
      // 1. 所有的 DNS 查询都会默认优先使用缓存的，即使 DNS 查询错误也不影响应用
      // 2. 对同一个域名，在 dnsCacheLookupInterval 的间隔内（默认 10s）只会查询一次
      enableDNSCache: false,
      request: {
        // 默认 request 超时时间
        timeout: 15000,
      },
      httpAgent: {
        // 默认开启 http KeepAlive 功能
        keepAlive: true,
        // 空闲的 KeepAlive socket 最长可以存活 4 秒
        freeSocketTimeout: 4000,
        // 当 socket 超过 30 秒都没有任何活动，就会被当作超时处理掉
        timeout: 30000,
        // 允许创建的最大 socket 数
        maxSockets: Number.MAX_SAFE_INTEGER,
        // 最大空闲 socket 数
        maxFreeSockets: 256,
      },
      httpsAgent: {
        // 默认开启 https KeepAlive 功能
        keepAlive: true,
        // 空闲的 KeepAlive socket 最长可以存活 4 秒
        freeSocketTimeout: 4000,
        // 当 socket 超过 30 秒都没有任何活动，就会被当作超时处理掉
        timeout: 30000,
        // 允许创建的最大 socket 数
        maxSockets: Number.MAX_SAFE_INTEGER,
        // 最大空闲 socket 数
        maxFreeSockets: 256,
      },
    },
    middleware: [
      'robotMiddleware',
      'gzipMiddleware',
      'webpackMiddleware',
      'notfoundMiddleware',
      'errorMiddleware'
    ],
    gzipMiddleware: {
      // 设置只有符合某些规则的请求才会经过这个中间件
      // match:'',
      // 设置符合某些规则的请求不经过这个中间件
      // ignore:'',
      // 控制中间件是否开启
      enable: true,
      // 小于 1k 的响应体不压缩
      threshold: 1024,
    },
    webpackMiddleware: {
      enable: false,
      compiler: {},
      others: {},
    },
    robotMiddleware: {
      enable: false,
      ua: [
        /curl/i,
        /Baiduspider/i,
      ],
    },
    // 自定义响应404
    notfoundMiddleware: {
      enable: true,
      // 应用代码的目录
      baseDir: appInfo.baseDir,
      // 404页面
      pageUrl: "app/view/404.html"
    },
    errorMiddleware: {
      enable: true,
      // 只对 /api 前缀的 url 路径生效
      match: '/api'
    },
    onerror: {
      // 线上页面发生异常时，重定向到这个页面上
      errorPageUrl: 'app/view/500.html',
      // all(err, ctx) {
      //   // 在此处定义针对所有响应类型的错误处理方法
      //   // 注意，定义了 config.all 之后，其他错误处理方法不会再生效
      //   ctx.body = 'error';
      //   ctx.status = 500;
      // },
      // html(err, ctx) {
      //   // html hander
      //   ctx.body = '<h3>error</h3>';
      //   ctx.status = 500;
      // },
      // json(err, ctx) {
      //   // json hander
      //   ctx.body = { message: 'error' };
      //   ctx.status = 500;
      // }
    },
    customerLogger: {
      file: `/var/log/egg-server-ssr/egg-server-ssr-app.log`,
      consoleLevel: 'DEBUG', // 终端日志级别
      fileLoggerLevel: 'DEBUG', // 文件日志级别
    },
    // 打开前置代理模式 若服务未部署在反向代理之后，请不要开启此配置
    // proxy: true
  };

  // add your special config in here
  const bizConfig = {
    sourceUrl: `https://github.com/eggjs/examples/tree/master/${appInfo.name}`,
    news: {
      pageSize: 5,
      serverUrl: 'https://hacker-news.firebaseio.com/v0',
    },
  };

  // the return config will combines to EggAppConfig
  return {
    ...config,
    ...bizConfig,
  };
};
