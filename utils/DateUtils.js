const dayjs = require('dayjs');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
dayjs.extend(isSameOrBefore);

class DateUtils {
  static formatDate(date, format = 'YYYY-MM-DD') {
    return dayjs(date).format(format);
  }

  static getWorkingDates(startDate, endDate, workingDays) {
    const dayMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
    const workingDayNums = workingDays.map(day => dayMap[day]);
    let dates = [];

    let current = dayjs(startDate);
    const end = dayjs(endDate);

    while (current.isSameOrBefore(end, 'day')) {

      if (workingDayNums.includes(current.day())) {
        dates.push(current.format('YYYY-MM-DD'));
      }
      current = current.add(1, 'day');
    }

    return dates;
  }

  static isWorkingDay(date, workingDays) {
    const dayOfWeek = dayjs(date).day();
    return workingDays.includes(dayOfWeek);
  }
}

module.exports = DateUtils;