import { useEffect, useMemo, useState } from 'react'
import {
  getTaskCodeForOccurrence,
  groupCompletionsByDate,
  reduceOrDeleteCompletion,
  splitTaskCode,
  subscribeToCompletionsInRange,
} from '../lib/completions'
import {
  getCalendarDays,
  getMonthBounds,
  getMonthLabel,
  getTodayString,
  isEditableDate,
  parseDateString,
  WEEKDAYS,
} from '../lib/dates'
import { deleteNoteForUser, groupNotesByDate, subscribeToNotesInRange } from '../lib/notes'
import { formatTaskLabel } from '../lib/tasks'
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

function getMembersWithContent(dayCompletions, dayNotes) {
  return MEMBER_ORDER.filter(
    (name) => dayCompletions[name]?.length || dayNotes[name],
  )
}

function DayPreview({ dayCompletions, dayNotes }) {
  const membersWithContent = getMembersWithContent(dayCompletions, dayNotes)

  if (membersWithContent.length === 0) {
    return <p className="calendar-empty">No tasks logged</p>
  }

  return membersWithContent.map((memberName) => (
    <div key={memberName} className="calendar-member">
      <p className="calendar-member-name">{memberName}</p>
      {dayCompletions[memberName]?.length > 0 && (
        <p className="calendar-member-codes">
          {dayCompletions[memberName].map((task) => task.code).join(', ')}
        </p>
      )}
      {dayNotes[memberName] && (
        <p className="calendar-note-indicator" title={dayNotes[memberName].text}>
          Note
        </p>
      )}
    </div>
  ))
}

function DayExpandedContent({
  dayCompletions,
  dayNotes,
  currentUser,
  dateString,
  onRequestDelete,
}) {
  const currentName = currentUser?.displayName
  const canEditDate = Boolean(currentUser) && isEditableDate(dateString)

  return MEMBER_ORDER.map((memberName) => {
    const tasks = dayCompletions[memberName] || []
    const note = dayNotes[memberName]
    const isOwnSection = currentName === memberName

    return (
      <div key={memberName} className="calendar-modal-member">
        <h3>{memberName}</h3>
        {tasks.length === 0 && !note ? (
          <p className="calendar-modal-empty">No tasks logged</p>
        ) : (
          <>
            {tasks.length > 0 && (
              <ul>
                {tasks.map((task) => (
                  <li key={task.id || `${memberName}-${task.code}`} className="calendar-modal-task">
                    <span>{formatTaskLabel(task)}</span>
                    {isOwnSection && canEditDate && (
                      <button
                        type="button"
                        className="completion-delete-btn"
                        onClick={() => onRequestDelete({ type: 'completion', ...task })}
                        aria-label={`Delete ${formatTaskLabel(task)}`}
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {note && (
              <div className="calendar-modal-note">
                <div className="calendar-modal-note-header">
                  <p className="calendar-modal-note-label">Note</p>
                  {isOwnSection && canEditDate && (
                    <button
                      type="button"
                      className="completion-delete-btn"
                      onClick={() => onRequestDelete({ type: 'note', ...note })}
                      aria-label="Delete note"
                    >
                      ×
                    </button>
                  )}
                </div>
                <p className="calendar-modal-note-text">{note.text}</p>
              </div>
            )}
          </>
        )}
      </div>
    )
  })
}

function SharedCalendar({ user }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [completions, setCompletions] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedDay, setExpandedDay] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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

  const notesByDate = useMemo(
    () => groupNotesByDate(notes),
    [notes],
  )

  useEffect(() => {
    setLoading(true)
    setError('')

    let completionsReady = false
    let notesReady = false
    let completionsError = null
    let notesError = null

    const markReady = () => {
      if (completionsReady && notesReady) {
        setLoading(false)
        setError(completionsError || notesError || '')
      }
    }

    const unsubscribeCompletions = subscribeToCompletionsInRange(
      start,
      end,
      (nextCompletions) => {
        setCompletions(nextCompletions)
        completionsReady = true
        markReady()
      },
      (err) => {
        console.error('Failed to load calendar completions:', err)
        completionsError = 'Could not load the calendar.'
        completionsReady = true
        markReady()
      },
    )

    const unsubscribeNotes = subscribeToNotesInRange(
      start,
      end,
      (nextNotes) => {
        setNotes(nextNotes)
        notesReady = true
        markReady()
      },
      (err) => {
        console.error('Failed to load calendar notes:', err)
        notesError = 'Could not load the calendar.'
        notesReady = true
        markReady()
      },
    )

    return () => {
      unsubscribeCompletions()
      unsubscribeNotes()
    }
  }, [start, end])

  useEffect(() => {
    if (!expandedDay) return

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      if (pendingDelete) {
        setPendingDelete(null)
        setDeleteError('')
        return
      }
      setExpandedDay(null)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [expandedDay, pendingDelete])

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
  const expandedDayNotes = expandedDay
    ? notesByDate[expandedDay.dateString] || {}
    : {}

  const closeExpandedDay = () => {
    setExpandedDay(null)
    setPendingDelete(null)
    setDeleteError('')
  }

  const handleConfirmDelete = async () => {
    if (!pendingDelete || !user) return

    setDeleting(true)
    setDeleteError('')

    try {
      if (pendingDelete.type === 'note') {
        await deleteNoteForUser(user, pendingDelete)
      } else {
        await reduceOrDeleteCompletion(user, pendingDelete)
      }
      setPendingDelete(null)
    } catch (err) {
      console.error('Failed to delete:', err)
      setDeleteError(
        pendingDelete.type === 'note'
          ? 'Could not delete this note. Please try again.'
          : 'Could not delete this task. Please try again.',
      )
    } finally {
      setDeleting(false)
    }
  }

  const isNoteDelete = pendingDelete?.type === 'note'
  const pendingDeleteLabel = pendingDelete && !isNoteDelete
    ? formatTaskLabel(pendingDelete)
    : ''
  const pendingSplit = pendingDelete && !isNoteDelete
    ? splitTaskCode(pendingDelete.code)
    : null
  const pendingNextCode =
    pendingSplit && pendingSplit.occurrence > 1
      ? getTaskCodeForOccurrence(pendingSplit.baseCode, pendingSplit.occurrence - 1)
      : ''

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
          const dayNotes = notesByDate[day.dateString] || {}

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
                <DayPreview dayCompletions={dayCompletions} dayNotes={dayNotes} />
              </div>
            </button>
          )
        })}
      </div>

      {expandedDay && (
        <div
          className="calendar-modal-overlay"
          onClick={closeExpandedDay}
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
              onClick={closeExpandedDay}
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
              <DayExpandedContent
                dayCompletions={expandedDayCompletions}
                dayNotes={expandedDayNotes}
                currentUser={user}
                dateString={expandedDay.dateString}
                onRequestDelete={(task) => {
                  setDeleteError('')
                  setPendingDelete(task)
                }}
              />
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div
          className="confirm-overlay"
          onClick={() => {
            if (deleting) return
            setPendingDelete(null)
            setDeleteError('')
          }}
          role="presentation"
        >
          <div
            className="confirm-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-title"
          >
            <h3 id="confirm-delete-title">
              {isNoteDelete ? 'Delete this note?' : 'Delete this task?'}
            </h3>
            <p>
              {isNoteDelete
                ? 'This note will be permanently deleted.'
                : pendingNextCode
                  ? `${pendingDeleteLabel} will become ${pendingNextCode}.`
                  : `${pendingDeleteLabel} will be permanently deleted.`}
            </p>
            {deleteError && <p className="confirm-error" role="alert">{deleteError}</p>}
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-cancel-btn"
                onClick={() => {
                  setPendingDelete(null)
                  setDeleteError('')
                }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-delete-btn"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default SharedCalendar
