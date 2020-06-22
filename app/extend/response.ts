/**
 * response 响应相关的属性和方法扩展
 */

export default {
  set foo(value) {
    // 使用 this.response.foo = 'bar'
    // this.set('x-response-foo', value);
    console.log(value);
  },
};
