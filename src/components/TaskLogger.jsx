import { useEffect, useState } from 'react'
import { getCompletionsForUserDate, saveCompletionsForDate } from '../lib/completions'
import { clampToEditableDate, getTodayString, getYesterdayString, isEditableDate } from '../lib/dates'
import { getNoteForUserDate, MAX_NOTE_LENGTH, saveNoteForDate } from '../lib/notes'
import { ensureDefaultTasks, formatTaskDropdownLabel, subscribeToActiveTasks } from '../lib/tasks'
import './TaskLogger.css'

function TaskLogger({ user }) {
  const [tasks, setTasks] = useState([])
  const [selectedDate, setSelectedDate] = useState(getTodayString())
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set())
  const [noteText, setNoteText] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [loadingEntry, setLoadingEntry] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const today = getTodayString()
  const yesterday = getYesterdayString()
  const displayName = user.displayName || user.email
  const editableDateError = 'You can only log tasks for today or yesterday.'

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

    async function loadExistingEntry() {
      setLoadingEntry(true)
      setError('')
      setMessage('')

      try {
        const [existingCompletions, existingNote] = await Promise.all([
          getCompletionsForUserDate(user.uid, selectedDate),
          getNoteForUserDate(user.uid, selectedDate),
        ])
        setSelectedTaskIds(new Set(existingCompletions.map((item) => item.taskId)))
        setNoteText(existingNote?.text || '')
      } catch (err) {
        console.error('Failed to load entry:', err)
        setError('Could not load your entry for this date.')
      } finally {
        setLoadingEntry(false)
      }
    }

    loadExistingEntry()
  }, [user, selectedDate])

  const toggleTask = (taskId) => {
    setSelectedTaskIds((current) => {
      const next = new Set(current)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
    setMessage('')
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

  const handleSave = async () => {
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
      await Promise.all([
        saveCompletionsForDate(user, selectedDate, selectedTasks),
        saveNoteForDate(user, selectedDate, noteText),
      ])
      setMessage(`Saved ${displayName}'s entry for ${selectedDate}.`)
      setDropdownOpen(false)
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

  return (
    <section className="task-logger">
      <div className="task-logger-header">
        <h2>Log tasks</h2>
        <p>Select a date (today or yesterday), choose tasks, and add optional notes.</p>
      </div>

      <div className="task-logger-controls">
        <label className="task-logger-date">
          <span>Date</span>
          <input
            type="date"
            value={selectedDate}
            min={yesterday}
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

        <div className="task-dropdown">
          <button
            type="button"
            className="task-dropdown-toggle"
            onClick={() => setDropdownOpen((open) => !open)}
            disabled={loadingTasks || loadingEntry || !isEditableDate(selectedDate)}
            aria-expanded={dropdownOpen}
          >
            {dropdownOpen ? 'Hide tasks ▲' : 'Select tasks ▼'}
          </button>

          {dropdownOpen && (
            <div className="task-dropdown-panel">
              {loadingTasks || loadingEntry ? (
                <p className="task-dropdown-status">Loading…</p>
              ) : (
                <ul className="task-checkbox-list">
                  {tasks.map((task) => (
                    <li key={task.id}>
                      <label className="task-checkbox-item">
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.has(task.id)}
                          onChange={() => toggleTask(task.id)}
                        />
                        <span>{formatTaskDropdownLabel(task)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
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
          disabled={loadingEntry || !isEditableDate(selectedDate)}
        />
        <span className="task-notes-count">
          {noteText.length}/{MAX_NOTE_LENGTH}
        </span>
      </label>

      <button
        type="button"
        className="task-save-btn task-save-btn-main"
        onClick={handleSave}
        disabled={saving || loadingEntry || !isEditableDate(selectedDate)}
      >
        {saving ? 'Saving…' : 'Save entry'}
      </button>

      {message && <p className="task-logger-message">{message}</p>}
      {error && <p className="task-logger-error" role="alert">{error}</p>}
    </section>
  )
}

export default TaskLogger
