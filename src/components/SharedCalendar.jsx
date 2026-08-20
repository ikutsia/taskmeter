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
  WEEKDAYS,
} from '../lib/dates'
import './SharedCalendar.css'

const MEMBER_ORDER = ['Irakli', 'Nino']

function SharedCalendar() {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [completions, setCompletions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
          const membersWithTasks = MEMBER_ORDER.filter(
            (name) => dayCompletions[name]?.length,
          )

          return (
            <article
              key={day.dateString}
              className={[
                'calendar-day',
                !day.isCurrentMonth && 'other-month',
                day.dateString === todayString && 'today',
                day.dateString > todayString && 'future',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <header className="calendar-day-header">
                <span className="calendar-day-number">{day.dayOfMonth}</span>
                <span className="calendar-day-weekday">{day.dayOfWeek}</span>
              </header>

              <div className="calendar-day-body">
                {membersWithTasks.length === 0 ? (
                  <p className="calendar-empty">No tasks logged</p>
                ) : (
                  membersWithTasks.map((memberName) => (
                    <div key={memberName} className="calendar-member">
                      <p className="calendar-member-name">{memberName}</p>
                      <ul>
                        {dayCompletions[memberName].map((taskName) => (
                          <li key={`${memberName}-${taskName}`}>{taskName}</li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default SharedCalendar
