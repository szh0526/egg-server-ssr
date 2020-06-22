/**
 * Request 请求相关的属性和方法扩展
 */
const FOO = Symbol('Context#foo');

export default {
  get foo() {
    // this 就是 ctx 对象，在其中可以调用 ctx 上的其他方法，或访问属性
    if (!this[FOO]) {
      this[FOO] = 'ceshifoo';
    }
    return this[FOO];
  },
};
