import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export const ASIA_SHANGHAI_TZ = 'Asia/Shanghai';

export const parseScheduledTime = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const parsedLocal = dayjs(value, 'YYYY/MM/DD HH:mm', true);
  if (!parsedLocal.isValid()) {
    return null;
  }
  return parsedLocal.tz(ASIA_SHANGHAI_TZ).toDate();
};

export const minutesBefore = (date: Date, minutes: number): Date =>
  dayjs(date).subtract(minutes, 'minute').toDate();

export const millisUntil = (date: Date): number => Math.max(dayjs(date).diff(dayjs(), 'millisecond'), 0);

export const formatDateTime = (date: Date): string =>
  dayjs(date).tz(ASIA_SHANGHAI_TZ).format('YYYY-MM-DD HH:mm:ss');
