import { eachDayOfInterval } from 'date-fns';

// Default working calendar configuration
export const DEFAULT_CALENDAR = {
  workingDays: [1, 2, 3, 4, 5], // Monday=1, Tuesday=2, ..., Friday=5
  hoursPerDay: 8,
  holidays: [], // ISO date strings: ['2025-12-25', '2025-01-01']
};

/**
 * Calculate working hours in a date range based on the calendar
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {Object} calendar - working calendar config
 * @returns {number} - total working hours
 */
export const calculateWorkingHours = (startDate, endDate, calendar = DEFAULT_CALENDAR) => {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  let hours = 0;

  days.forEach(day => {
    const dayOfWeek = day.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const dateStr = day.toISOString().split('T')[0];

    // Check if it's a working day and not a holiday
    if (calendar.workingDays.includes(dayOfWeek) && !calendar.holidays.includes(dateStr)) {
      hours += calendar.hoursPerDay;
    }
  });

  return hours;
};

/**
 * Count working days in a date range
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {Object} calendar - working calendar config
 * @returns {number} - count of working days
 */
export const countWorkingDays = (startDate, endDate, calendar = DEFAULT_CALENDAR) => {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  let count = 0;

  days.forEach(day => {
    const dayOfWeek = day.getDay();
    const dateStr = day.toISOString().split('T')[0];

    if (calendar.workingDays.includes(dayOfWeek) && !calendar.holidays.includes(dateStr)) {
      count += 1;
    }
  });

  return count;
};

/**
 * Calculate working hours for a task within a specific period
 * @param {Object} task - task object with start_date, end_date, estimated_hours
 * @param {Date} periodStart
 * @param {Date} periodEnd
 * @param {Object} calendar
 * @param {String} hoursField - which hours field to use (optional)
 * @returns {number} - hours allocated to this period
 */
export const calculateTaskHoursInPeriod = (task, periodStart, periodEnd, calendar = DEFAULT_CALENDAR, hoursField = null) => {
  const taskStart = new Date(task.actual_start_date || task.start_date);
  const taskEnd = new Date(task.actual_end_date || task.end_date);

  // Find overlap between task and period
  const overlapStart = taskStart > periodStart ? taskStart : periodStart;
  const overlapEnd = taskEnd < periodEnd ? taskEnd : periodEnd;

  if (overlapStart > overlapEnd) {
    return 0; // No overlap
  }

  // Calculate total task working hours
  const taskTotalHours = calculateWorkingHours(taskStart, taskEnd, calendar);
  if (taskTotalHours === 0) return 0;

  // Calculate overlap working hours
  const overlapHours = calculateWorkingHours(overlapStart, overlapEnd, calendar);

  // Distribute task hours proportionally
  let taskEstimatedHours;
  if (hoursField) {
    taskEstimatedHours = task[hoursField] || 0;
  } else {
    taskEstimatedHours = task.internal_employee_planned_hours || task.estimated_hours || 0;
  }
  return (overlapHours / taskTotalHours) * taskEstimatedHours;
};

/**
 * Calculate total task hours for actual hours
 * @param {Object} task
 * @param {Date} periodStart
 * @param {Date} periodEnd
 * @param {Object} calendar
 * @returns {number}
 */
export const calculateTaskActualHoursInPeriod = (task, periodStart, periodEnd, calendar = DEFAULT_CALENDAR) => {
  const taskStart = new Date(task.actual_start_date || task.start_date);
  const taskEnd = new Date(task.actual_end_date || task.end_date);

  const overlapStart = taskStart > periodStart ? taskStart : periodStart;
  const overlapEnd = taskEnd < periodEnd ? taskEnd : periodEnd;

  if (overlapStart > overlapEnd) {
    return 0;
  }

  const taskTotalHours = calculateWorkingHours(taskStart, taskEnd, calendar);
  if (taskTotalHours === 0) return 0;

  const overlapHours = calculateWorkingHours(overlapStart, overlapEnd, calendar);
  const taskActualHours = task.internal_employee_actual_hours || task.actual_hours || 0;
  return (overlapHours / taskTotalHours) * taskActualHours;
};

/**
 * Get capacity (available hours) for a period based on calendar
 * @param {Date} periodStart
 * @param {Date} periodEnd
 * @param {Object} calendar
 * @returns {number} - capacity in hours
 */
export const getCapacityForPeriod = (periodStart, periodEnd, calendar = DEFAULT_CALENDAR) => {
  return calculateWorkingHours(periodStart, periodEnd, calendar);
};