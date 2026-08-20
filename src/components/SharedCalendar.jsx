import { useEffect, useMemo, useState } from 'react'
import {
  groupCompletionsByDate,
  subscribeToCompletionsInRange,
} from '../lib/completions'
import {
  getCalendarDays,
  getMonthBounds,
  getMonthLabel,
  getTodayString,
  parseDateString,
  WEEKDAYS,
} from '../lib/dates'
import './SharedCalendar.css'

const MEMBER_ORDER = ['Irakli', 'Nino']

function formatExpandedDayLabel(dateString, dayOfWeek) {
  const date = parseDateString(dateString)
  const formatted = date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  return `${formatted} — ${dayOfWeek}`
}

function DayPreview({ dayCompletions }) {
  const membersWithTasks = MEMBER_ORDER.filter(
    (name) => dayCompletions[name]?.length,
  )

  if (membersWithTasks.length === 0) {
    return <p className="calendar-empty">No tasks logged</p>
  }

  return membersWithTasks.map((memberName) => (
    <div key={memberName} className="calendar-member">
      <p className="calendar-member-name">{memberName}</p>
      <ul>
        {dayCompletions[memberName].map((taskName) => (
          <li key={`${memberName}-${taskName}`}>{taskName}</li>
        ))}
      </ul>
    </div>
  ))
}

function DayExpandedContent({ dayCompletions }) {
  return MEMBER_ORDER.map((memberName) => {
    const tasks = dayCompletions[memberName] || []

    return (
      <div key={memberName} className="calendar-modal-member">
        <h3>{memberName}</h3>
        {tasks.length === 0 ? (
          <p className="calendar-modal-empty">No tasks logged</p>
        ) : (
          <ul>
            {tasks.map((taskName) => (
              <li key={`${memberName}-${taskName}`}>{taskName}</li>
            ))}
          </ul>
        )}
      </div>
    )
  })
}

function SharedCalendar() {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [completions, setCompletions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedDay, setExpandedDay] = useState(null)

  const { start, end } = useMemo(
    () => getMonthBounds(viewYear, viewMonth),
    [viewYear, viewMonth],
  )

  const calendarDays = useMemo(
    () => getCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth],
  )

  const completionsByDate = useMemo(
    () => groupCompletionsByDate(completions),
    [completions],
  )

  useEffect(() => {
    setLoading(true)
    setError('')

    const unsubscribe = subscribeToCompletionsInRange(
      start,
      end,
      (nextCompletions) => {
        setCompletions(nextCompletions)
        setLoading(false)
      },
      (err) => {
        console.error('Failed to load calendar:', err)
        setError('Could not load the calendar.')
        setLoading(false)
      },
    )

    return unsubscribe
  }, [start, end])

  useEffect(() => {
    if (!expandedDay) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setExpandedDay(null)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [expandedDay])

  const goToPreviousMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((year) => year - 1)
      return
    }
    setViewMonth((month) => month - 1)
  }

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((year) => year + 1)
      return
    }
    setViewMonth((month) => month + 1)
  }

  const todayString = getTodayString()
  const expandedDayCompletions = expandedDay
    ? completionsByDate[expandedDay.dateString] || {}
    : {}

  return (
    <section className="shared-calendar">
      <div className="calendar-toolbar">
        <h2>{getMonthLabel(viewYear, viewMonth)}</h2>
        <div className="calendar-nav">
          <button type="button" onClick={goToPreviousMonth} aria-label="Previous month">
            ←
          </button>
          <button type="button" onClick={goToNextMonth} aria-label="Next month">
            →
          </button>
        </div>
      </div>

      {loading && <p className="calendar-status">Loading calendar…</p>}
      {error && <p className="calendar-error" role="alert">{error}</p>}

      <div className="calendar-grid">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="calendar-weekday">
            {weekday}
          </div>
        ))}

        {calendarDays.map((day) => {
          const dayCompletions = completionsByDate[day.dateString] || {}

          return (
            <button
              key={day.dateString}
              type="button"
              className={[
                'calendar-day',
                !day.isCurrentMonth && 'other-month',
                day.dateString === todayString && 'today',
                day.dateString > todayString && 'future',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setExpandedDay(day)}
              aria-label={`View details for ${formatExpandedDayLabel(day.dateString, day.dayOfWeek)}`}
            >
              <header className="calendar-day-header">
                <span className="calendar-day-number">{day.dayOfMonth}</span>
                <span className="calendar-day-weekday">{day.dayOfWeek}</span>
              </header>

              <div className="calendar-day-body">
                <DayPreview dayCompletions={dayCompletions} />
              </div>
            </button>
          )
        })}
      </div>

      {expandedDay && (
        <div
          className="calendar-modal-overlay"
          onClick={() => setExpandedDay(null)}
          role="presentation"
        >
          <div
            className="calendar-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-modal-title"
          >
            <button
              type="button"
              className="calendar-modal-close"
              onClick={() => setExpandedDay(null)}
              aria-label="Close day details"
            >
              ×
            </button>

            <header className="calendar-modal-header">
              <h2 id="calendar-modal-title">
                {formatExpandedDayLabel(expandedDay.dateString, expandedDay.dayOfWeek)}
              </h2>
            </header>

            <div className="calendar-modal-content">
              <DayExpandedContent dayCompletions={expandedDayCompletions} />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default SharedCalendar
