import Service from './../core/baseService';
import { Context } from 'egg';

interface ListParam {
  page: number;
  pageSize: number;
  id: string;
  orders: string[][];
  columns: string[];
}
export interface NewsItem {
  id: number;
  title: string;
  url: string;
  time: number;
}

export default class NewsService extends Service {
  constructor(ctx: Context) {
    super(ctx);
    this.rootUrl = 'https://cnodejs.org/api/v1';
  }

  public async list(page = 1): Promise<NewsItem[]> {
    const { serverUrl, pageSize } = this.config.news;
    const { data: idList } = await this.ctx.curl(`${serverUrl}/topstories.json`, {
      data: {
        orderBy: '"$key"',
        startAt: `"${pageSize * (page - 1)}"`,
        endAt: `"${pageSize * page - 1}"`,
      },
      dataType: 'json',
      timing: true
    });

    const newsList = await Promise.all(
      Object.keys(idList).map(key => {
        const url = `${serverUrl}/item/${idList[key]}.json`;
        return this.ctx.curl(url, { dataType: 'json' });
      }),
    );

    return newsList.map(res => res.data);
  }

  public async list2(param: ListParam) {
    this.ctx.logger.info(param);
    // 调用 CNode V1 版本 API
    const result = await this.ctx.curl(`${this.rootUrl}/topics`, {
      method: 'POST',
      data: param,
      dataType: 'json',
      contentType: 'json'
    });
    // 检查调用是否成功，如果调用失败会抛出异常
    this.checkSuccess(result);
    // 返回创建的 topic 的 id
    return result.data.topic_id;
  }
}
