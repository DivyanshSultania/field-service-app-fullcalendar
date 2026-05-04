import dayjsBase from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjsBase.extend(utc);
dayjsBase.extend(timezone);
dayjsBase.extend(customParseFormat);

export const dayjs = dayjsBase;

export const DEFAULT_APP_TIMEZONE = 'Australia/Sydney';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;

export const getAppTimezone = (env = {}) => env?.APP_TIMEZONE || DEFAULT_APP_TIMEZONE;

export const isValidTimezone = (timezoneName) => {
	if (!timezoneName || typeof timezoneName !== 'string') return false;

	try {
		new Intl.DateTimeFormat('en-US', { timeZone: timezoneName }).format();
		return true;
	} catch {
		return false;
	}
};

export const getRequestTimezone = (req, env = {}) => {
	const headerTimezone =
		req?.header?.('X-Timezone') ||
		req?.header?.('x-timezone') ||
		req?.headers?.get?.('X-Timezone') ||
		req?.headers?.get?.('x-timezone') ||
		null;

	return isValidTimezone(headerTimezone)
		? headerTimezone
		: getAppTimezone(env);
};

export const toZonedDateTime = (value, timezoneName) => {
	if (value == null || value === '') return null;

	if (dayjs.isDayjs(value)) {
		return value.tz(timezoneName);
	}

	const text = String(value);
	let parsed;

	if (DATE_ONLY_RE.test(text)) {
		parsed = dayjs.tz(text, 'YYYY-MM-DD', timezoneName);
	} else if (LOCAL_DATETIME_RE.test(text)) {
		const format = text.length === 16 ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DDTHH:mm:ss';
		parsed = dayjs.tz(text, format, timezoneName);
	} else {
		parsed = dayjs(value);
	}

	return parsed.isValid() ? parsed.tz(timezoneName) : null;
};

export const getUtcStartOfLocalDay = (value, timezoneName) => {
	const local = toZonedDateTime(value, timezoneName);
	return local ? local.startOf('day').utc().toISOString() : null;
};

export const getUtcStartOfNextLocalDay = (value, timezoneName) => {
	const local = toZonedDateTime(value, timezoneName);
	return local ? local.startOf('day').add(1, 'day').utc().toISOString() : null;
};

export const getUtcEndOfLocalDay = (value, timezoneName) => {
	const local = toZonedDateTime(value, timezoneName);
	return local ? local.endOf('day').utc().toISOString() : null;
};

export const getUtcEndOfPreviousLocalDay = (value, timezoneName) => {
	const local = toZonedDateTime(value, timezoneName);
	return local ? local.startOf('day').subtract(1, 'millisecond').utc().toISOString() : null;
};

export const buildUtcRangeFromLocalDates = ({
	from,
	to,
	timezoneName,
	inclusiveTo = false
}) => {
	const fromUtc = from ? getUtcStartOfLocalDay(from, timezoneName) : null;
	const toUtcExclusive = to
		? (inclusiveTo
			? getUtcStartOfNextLocalDay(to, timezoneName)
			: getUtcStartOfLocalDay(to, timezoneName))
		: null;

	return { fromUtc, toUtcExclusive };
};

export const combineLocalDateAndTimeToUtcIso = ({
	dateValue,
	timeText,
	timezoneName
}) => {
	if (!dateValue || !timeText) return null;

	const localDate = toZonedDateTime(dateValue, timezoneName);
	if (!localDate) return null;

	const localDateTime = dayjs.tz(
		`${localDate.format('YYYY-MM-DD')}T${timeText}`,
		'YYYY-MM-DDTHH:mm',
		timezoneName
	);

	return localDateTime.isValid() ? localDateTime.utc().toISOString() : null;
};

export const compareLocalDays = (left, right, timezoneName) => {
	const leftDay = toZonedDateTime(left, timezoneName)?.startOf('day');
	const rightDay = toZonedDateTime(right, timezoneName)?.startOf('day');

	if (!leftDay || !rightDay) return null;
	if (leftDay.isBefore(rightDay)) return -1;
	if (leftDay.isAfter(rightDay)) return 1;
	return 0;
};

export const formatInTimezone = (value, timezoneName, pattern) => {
	const local = toZonedDateTime(value, timezoneName);
	return local ? local.format(pattern) : '';
};

export const getCurrentWeekUtcRange = (timezoneName, reference = dayjs()) => {
	const localNow = toZonedDateTime(reference, timezoneName);
	if (!localNow) return { startUtc: null, endUtcExclusive: null };

	const mondayOffset = (localNow.day() + 6) % 7;
	const weekStart = localNow.startOf('day').subtract(mondayOffset, 'day');

	return {
		startUtc: weekStart.utc().toISOString(),
		endUtcExclusive: weekStart.add(7, 'day').utc().toISOString()
	};
};
