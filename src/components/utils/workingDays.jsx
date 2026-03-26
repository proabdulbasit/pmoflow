import { eachDayOfInterval, isWeekend } from 'date-fns';

/**
 * Calculate the number of working days between two dates (excluding weekends)
 */
export function getWorkingDaysBetween(startDate, endDate) {
  const days = eachDayOfInterval({ start: new Date(startDate), end: new Date(endDate) });
  return days.filter(day => !isWeekend(day)).length;
}

/**
 * Calculate hours per working day
 */
export function getHoursPerWorkingDay(totalHours, startDate, endDate) {
  const workingDays = getWorkingDaysBetween(startDate, endDate);
  return workingDays > 0 ? totalHours / workingDays : 0;
}

/**
 * Calculate overlap working days between task period and display period
 */
export function getOverlapWorkingDays(taskStart, taskEnd, periodStart, periodEnd) {
  const overlapStart = taskStart < periodStart ? periodStart : taskStart;
  const overlapEnd = taskEnd > periodEnd ? periodEnd : taskEnd;
  
  if (overlapStart > overlapEnd) return 0;
  
  return getWorkingDaysBetween(overlapStart, overlapEnd);
}