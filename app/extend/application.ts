/**
 * Application 全局应用对象扩展
*/
const BAR = Symbol('Application#bar');

export default {
  get bar() {
    // this 就是 app 对象，在其中可以调用 app 上的其他方法，或访问属性
    if (!this[BAR]) {
      // 实际情况肯定更复杂
      this[BAR] = 'ceshi';
    }
    return this[BAR];
  },
};
