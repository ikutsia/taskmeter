import { useEffect, useState } from 'react'
import { saveCompletionsForDate } from '../lib/completions'
import { clampToEditableDate, getFirstDayOfPreviousMonthString, getTodayString, isEditableDate } from '../lib/dates'
import { MAX_NOTE_LENGTH, saveNoteForDate, subscribeToNoteForUserDate } from '../lib/notes'
import { ensureDefaultTasks, formatTaskLabel, subscribeToActiveTasks } from '../lib/tasks'
import './TaskLogger.css'

const COUNT_TASKS = {
  L: { max: 12, label: 'Hours' },
  R: { max: 5, label: 'Count' },
  S: { max: 5, label: 'Count' },
  Sh: { max: 12, label: 'Count' },
}

const EMPTY_COUNTS = { L: '', R: '', S: '', Sh: '' }

function TaskLogger({ user }) {
  const [tasks, setTasks] = useState([])
  const [selectedDate, setSelectedDate] = useState(getTodayString())
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set())
  const [countByCode, setCountByCode] = useState({ ...EMPTY_COUNTS })
  const [noteText, setNoteText] = useState('')
  const [taskPickerOpen, setTaskPickerOpen] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [loadingEntry, setLoadingEntry] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const today = getTodayString()
  const editStart = getFirstDayOfPreviousMonthString()
  const displayName = user.displayName || user.email
  const editableDateError = 'You can only log tasks for dates from the 1st of last month through today.'

  useEffect(() => {
    let unsubscribe = () => {}

    async function loadTasks() {
      try {
        await ensureDefaultTasks()
        unsubscribe = subscribeToActiveTasks(
          (nextTasks) => {
            setTasks(nextTasks)
            setLoadingTasks(false)
          },
          (err) => {
            console.error('Failed to load tasks:', err)
            setError('Could not load tasks.')
            setLoadingTasks(false)
          },
        )
      } catch (err) {
        console.error('Failed to prepare tasks:', err)
        setError('Could not load tasks.')
        setLoadingTasks(false)
      }
    }

    loadTasks()
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return

    setLoadingEntry(true)
    setError('')
    setMessage('')
    setSelectedTaskIds(new Set())
    setCountByCode({ ...EMPTY_COUNTS })

    const unsubscribe = subscribeToNoteForUserDate(
      user.uid,
      selectedDate,
      (existingNote) => {
        setNoteText(existingNote?.text || '')
        setLoadingEntry(false)
      },
      (err) => {
        console.error('Failed to load entry:', err)
        setError('Could not load your entry for this date.')
        setLoadingEntry(false)
      },
    )

    return unsubscribe
  }, [user, selectedDate])

  useEffect(() => {
    if (!taskPickerOpen) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeTaskPicker()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [taskPickerOpen])

  const toggleTask = (task) => {
    setSelectedTaskIds((current) => {
      const next = new Set(current)
      if (next.has(task.id)) {
        next.delete(task.id)
        if (COUNT_TASKS[task.code]) {
          setCountByCode((counts) => ({ ...counts, [task.code]: '' }))
        }
      } else {
        next.add(task.id)
        if (COUNT_TASKS[task.code] && !countByCode[task.code]) {
          setCountByCode((counts) => ({ ...counts, [task.code]: '1' }))
        }
      }
      return next
    })
    setMessage('')
  }

  const handleCountChange = (event, task) => {
    event.stopPropagation()
    const value = event.target.value
    setCountByCode((counts) => ({ ...counts, [task.code]: value }))
    setMessage('')

    setSelectedTaskIds((current) => {
      const next = new Set(current)
      if (value) {
        next.add(task.id)
      } else {
        next.delete(task.id)
      }
      return next
    })
  }

  const handleDateChange = (event) => {
    const nextDate = event.target.value
    if (!nextDate) return

    if (!isEditableDate(nextDate)) {
      setError(editableDateError)
      setSelectedDate(clampToEditableDate(nextDate))
      setMessage('')
      return
    }

    setError('')
    setMessage('')
    setSelectedDate(nextDate)
  }

  const closeTaskPicker = () => {
    setTaskPickerOpen(false)
    setSelectedTaskIds(new Set())
    setCountByCode({ ...EMPTY_COUNTS })
  }

  const handleSave = async ({ closeTaskPickerOnSuccess = false } = {}) => {
    if (!isEditableDate(selectedDate)) {
      setError(editableDateError)
      setSelectedDate(clampToEditableDate(selectedDate))
      return
    }

    if (noteText.trim().length > MAX_NOTE_LENGTH) {
      setError(`Notes must be ${MAX_NOTE_LENGTH} characters or fewer.`)
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    try {
      const selectedTasks = tasks.filter((task) => selectedTaskIds.has(task.id))
      const occurrenceByTaskId = {}
      selectedTasks.forEach((task) => {
        const config = COUNT_TASKS[task.code]
        if (!config) return
        const count = Number.parseInt(countByCode[task.code], 10)
        occurrenceByTaskId[task.id] = Number.isInteger(count)
          ? Math.min(config.max, Math.max(1, count))
          : 1
      })

      await Promise.all([
        saveCompletionsForDate(user, selectedDate, selectedTasks, occurrenceByTaskId),
        saveNoteForDate(user, selectedDate, noteText),
      ])
      setMessage(`Saved ${displayName}'s entry for ${selectedDate}.`)
      setSelectedTaskIds(new Set())
      setCountByCode({ ...EMPTY_COUNTS })
      if (closeTaskPickerOnSuccess) {
        closeTaskPicker()
      }
    } catch (err) {
      console.error('Failed to save entry:', err)
      if (err.message === 'INVALID_EDIT_DATE') {
        setError(editableDateError)
        setSelectedDate(getTodayString())
      } else if (err.message === 'NOTE_TOO_LONG') {
        setError(`Notes must be ${MAX_NOTE_LENGTH} characters or fewer.`)
      } else {
        setError('Could not save your entry. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  const selectedCount = selectedTaskIds.size
  const entryDisabled = loadingEntry || !isEditableDate(selectedDate)

  return (
    <section className="task-logger">
      <div className="task-logger-header">
        <h2>Log tasks</h2>
        <p>Select a date from last month through today, choose tasks, and add optional notes.</p>
      </div>

      <div className="task-logger-controls">
        <label className="task-logger-date">
          <span>Date</span>
          <input
            type="date"
            value={selectedDate}
            min={editStart}
            max={today}
            onChange={handleDateChange}
            onBlur={(event) => {
              const clamped = clampToEditableDate(event.target.value)
              if (clamped !== event.target.value) {
                setSelectedDate(clamped)
                setError(editableDateError)
              }
            }}
          />
        </label>

        <button
          type="button"
          className="task-picker-open-btn"
          onClick={() => {
            setSelectedTaskIds(new Set())
            setCountByCode({ ...EMPTY_COUNTS })
            setTaskPickerOpen(true)
          }}
          disabled={loadingTasks || entryDisabled}
        >
          Select tasks ▼
          {selectedCount > 0 && (
            <span className="task-picker-count">{selectedCount} selected</span>
          )}
        </button>
      </div>

      <label className="task-notes-field">
        <span>Notes (optional)</span>
        <textarea
          value={noteText}
          onChange={(event) => {
            setNoteText(event.target.value)
            setMessage('')
          }}
          placeholder="Add notes about your tasks, or describe something you did that is not on the list..."
          rows={4}
          maxLength={MAX_NOTE_LENGTH}
          disabled={entryDisabled}
        />
        <span className="task-notes-count">
          {noteText.length}/{MAX_NOTE_LENGTH}
        </span>
      </label>

      <button
        type="button"
        className="task-save-btn task-save-btn-main"
        onClick={() => handleSave()}
        disabled={saving || entryDisabled}
      >
        {saving ? 'Saving…' : 'Save entry'}
      </button>

      {message && <p className="task-logger-message">{message}</p>}
      {error && <p className="task-logger-error" role="alert">{error}</p>}

      {taskPickerOpen && (
        <div
          className="task-picker-overlay"
          onClick={closeTaskPicker}
          role="presentation"
        >
          <div
            className="task-picker-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-picker-title"
          >
            <header className="task-picker-header">
              <h3 id="task-picker-title">Select tasks</h3>
              <button
                type="button"
                className="task-picker-close"
                onClick={closeTaskPicker}
                aria-label="Close task selection"
              >
                ×
              </button>
            </header>

            <div className="task-picker-body">
              {loadingTasks || loadingEntry ? (
                <p className="task-picker-status">Loading…</p>
              ) : (
                <ul className="task-checkbox-list">
                  {tasks.map((task) => (
                    <li key={task.id}>
                      <label className="task-checkbox-item">
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.has(task.id)}
                          onChange={() => toggleTask(task)}
                        />
                        <span>{formatTaskLabel(task)}</span>
                      </label>
                      {COUNT_TASKS[task.code] && (
                        <label className="task-hours-select">
                          <span>{COUNT_TASKS[task.code].label}</span>
                          <select
                            value={countByCode[task.code] || ''}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => handleCountChange(event, task)}
                          >
                            <option value="">Select {COUNT_TASKS[task.code].label.toLowerCase()}</option>
                            {Array.from({ length: COUNT_TASKS[task.code].max }, (_, index) => index + 1).map((count) => (
                              <option key={count} value={String(count)}>
                                {count === 1 ? `1 (${task.code})` : `${count} (${task.code}${count})`}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="task-picker-footer">
              <button
                type="button"
                className="task-save-btn"
                onClick={() => handleSave({ closeTaskPickerOnSuccess: true })}
                disabled={saving || entryDisabled}
              >
                {saving ? 'Saving…' : 'Save entry'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  )
}

export default TaskLogger
