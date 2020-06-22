import { Service, Context } from 'egg';

/**
 * Test Service
 */
export default class Test extends Service {
  constructor(ctx: Context) {
    super(ctx);
  }

  /**
   * sayHi to you
   * @param name - your name
   */
  public async sayHi(name: string) {
    return `hi, ${name}`;
  }
}
