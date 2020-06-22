import { Application } from './typings/app';

export default (agent: Application) => {
  const start = Date.now();
  // 初始化

  // 也可以通过 messenger 对象发送消息给 App Worker
  // 但需要等待 App Worker 启动成功后才能发送，不然很可能丢失
  agent.messenger.on('egg-ready', () => {
    const data = {
      success: true
    };
    agent.messenger.sendToApp('agent_start_action', data);
  });
  
  agent.logger.info('启动耗时 %d ms', Date.now() - start);
}