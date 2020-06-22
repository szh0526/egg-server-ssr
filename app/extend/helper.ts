/**
 * Helper 实用的 utility 函数
 */
import * as moment from 'moment';

export default {
  relativeTime: time => moment(new Date(time)).format('YYYY-MM-DD HH:mm:ss'),
  lowercaseFirst: str => str[0].toLowerCase() + str.substring(1)
};
