const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function toDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getTodayString() {
  return toDateString(new Date())
}

export function getYesterdayString() {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return toDateString(date)
}

export function getFirstDayOfCurrentMonthString() {
  const today = new Date()
  return toDateString(new Date(today.getFullYear(), today.getMonth(), 1))
}

export function isEditableDate(dateString) {
  if (!dateString) return false
  return dateString >= getFirstDayOfCurrentMonthString() && dateString <= getTodayString()
}

export function clampToEditableDate(dateString) {
  if (!dateString) return getTodayString()

  const today = getTodayString()
  const monthStart = getFirstDayOfCurrentMonthString()

  if (dateString > today) return today
  if (dateString < monthStart) return monthStart
  return dateString
}

export function parseDateString(dateString) {
  const [y, m, d] = dateString.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function getMonthLabel(year, month) {
  return new Date(year, month, 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  })
}

export function getMonthBounds(year, month) {
  const monthNumber = String(month + 1).padStart(2, '0')
  const lastDay = new Date(year, month + 1, 0).getDate()
  const lastDayString = String(lastDay).padStart(2, '0')

  return {
    start: `${year}-${monthNumber}-01`,
    end: `${year}-${monthNumber}-${lastDayString}`,
  }
}

export function getCalendarDays(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = (firstOfMonth.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - startOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)

    return {
      date,
      dateString: toDateString(date),
      dayOfMonth: date.getDate(),
      dayOfWeek: WEEKDAYS[(date.getDay() + 6) % 7],
      isCurrentMonth: date.getMonth() === month,
    }
  })
}

export { WEEKDAYS }
