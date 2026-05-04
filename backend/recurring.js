import { toZonedDateTime } from './timezone.js';

const DEFAULT_FREQUENCY = 1;
const DAYS_IN_WEEK = 7;

export const getRecurringWeekdayOffset = (weekday) => (weekday === 0 ? 6 : weekday - 1);

export const getRecurringWeekStart = (dateInput, timezoneName) => {
	const baseDate = toZonedDateTime(dateInput, timezoneName);
	if (!baseDate) return null;

	return baseDate
		.startOf('day')
		.subtract(getRecurringWeekdayOffset(baseDate.day()), 'day');
};

export const getRecurringDateForWeekday = (weekStartInput, weekday) =>
	weekStartInput.add(getRecurringWeekdayOffset(weekday), 'day').startOf('day');

export const normalizeRecurringWeekdays = (selectedDays = []) =>
	[...new Set(selectedDays.map(Number))].sort(
		(a, b) => getRecurringWeekdayOffset(a) - getRecurringWeekdayOffset(b)
	);

export const generateRecurringDates = ({
	startingDate,
	selectedDays = [],
	closeDate = null,
	occurrences,
	frequency,
	timezoneName
}) => {
	const sortedSelectedDays = normalizeRecurringWeekdays(selectedDays);
	if (sortedSelectedDays.length === 0) return [];

	const startBoundary = toZonedDateTime(startingDate, timezoneName);
	if (!startBoundary) return [];

	const startBoundaryDay = startBoundary.startOf('day');

	const recurrenceFrequency = Math.max(DEFAULT_FREQUENCY, Number(frequency) || DEFAULT_FREQUENCY);
	const totalOccurrences = Number(occurrences);
	const normalizedOccurrences =
		Number.isFinite(totalOccurrences) && totalOccurrences > 0 ? totalOccurrences : null;

	let endBoundaryDay = closeDate ? toZonedDateTime(closeDate, timezoneName)?.startOf('day') : null;

	if (!endBoundaryDay) {
		endBoundaryDay = startBoundaryDay.add(
			DAYS_IN_WEEK * (normalizedOccurrences || 1) * recurrenceFrequency,
			'day'
		);
	}

	const results = [];
	let createdCycles = 0;
	let weekStart = getRecurringWeekStart(startBoundary, timezoneName);

	if (!weekStart) return [];

	while (true) {
		let anyRecurringCreated = false;

		for (const weekday of sortedSelectedDays) {
			const nextDate = getRecurringDateForWeekday(weekStart, weekday);

			if (!nextDate.isAfter(startBoundaryDay, 'day')) {
				continue;
			}

			if (endBoundaryDay && nextDate.isAfter(endBoundaryDay, 'day')) {
				continue;
			}

			results.push(nextDate);
			anyRecurringCreated = true;
		}

		if (anyRecurringCreated) {
			createdCycles++;
		}

		if (normalizedOccurrences && createdCycles >= normalizedOccurrences) {
			break;
		}

		const nextWeekStart = weekStart.add(DAYS_IN_WEEK * recurrenceFrequency, 'day');

		if (endBoundaryDay && nextWeekStart.isAfter(endBoundaryDay, 'day')) {
			break;
		}

		weekStart = nextWeekStart;
	}

	return results;
};
