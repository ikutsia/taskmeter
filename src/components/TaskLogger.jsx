import { useEffect, useState } from 'react'
import { getCompletionsForUserDate, saveCompletionsForDate } from '../lib/completions'
import { clampToToday, getTodayString, isFutureDate } from '../lib/dates'
import { ensureDefaultTasks, subscribeToActiveTasks } from '../lib/tasks'
import './TaskLogger.css'

function TaskLogger({ user }) {
  const [tasks, setTasks] = useState([])
  const [selectedDate, setSelectedDate] = useState(getTodayString())
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set())
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [loadingEntry, setLoadingEntry] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const today = getTodayString()
  const displayName = user.displayName || user.email

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
        const existing = await getCompletionsForUserDate(user.uid, selectedDate)
        setSelectedTaskIds(new Set(existing.map((item) => item.taskId)))
      } catch (err) {
        console.error('Failed to load entry:', err)
        setError('Could not load your tasks for this date.')
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

    if (isFutureDate(nextDate)) {
      setError('You can only log tasks for today or past dates.')
      setSelectedDate(getTodayString())
      setMessage('')
      return
    }

    setError('')
    setMessage('')
    setSelectedDate(nextDate)
  }

  const handleSave = async () => {
    if (isFutureDate(selectedDate)) {
      setError('You can only log tasks for today or past dates.')
      setSelectedDate(getTodayString())
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    try {
      const selectedTasks = tasks.filter((task) => selectedTaskIds.has(task.id))
      await saveCompletionsForDate(user, selectedDate, selectedTasks)
      setMessage(`Saved ${displayName}'s tasks for ${selectedDate}.`)
      setDropdownOpen(false)
    } catch (err) {
      console.error('Failed to save entry:', err)
      if (err.message === 'FUTURE_DATE') {
        setError('You can only log tasks for today or past dates.')
        setSelectedDate(getTodayString())
      } else {
        setError('Could not save your tasks. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="task-logger">
      <div className="task-logger-header">
        <h2>Log tasks</h2>
        <p>Select a date and choose the tasks {displayName} completed.</p>
      </div>

      <div className="task-logger-controls">
        <label className="task-logger-date">
          <span>Date</span>
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={handleDateChange}
            onBlur={(event) => {
              const clamped = clampToToday(event.target.value)
              if (clamped !== event.target.value) {
                setSelectedDate(clamped)
                setError('You can only log tasks for today or past dates.')
              }
            }}
          />
        </label>

        <div className="task-dropdown">
          <button
            type="button"
            className="task-dropdown-toggle"
            onClick={() => setDropdownOpen((open) => !open)}
            disabled={loadingTasks || loadingEntry || isFutureDate(selectedDate)}
            aria-expanded={dropdownOpen}
          >
            {dropdownOpen ? 'Hide tasks ▲' : 'Select tasks ▼'}
          </button>

          {dropdownOpen && (
            <div className="task-dropdown-panel">
              {loadingTasks || loadingEntry ? (
                <p className="task-dropdown-status">Loading…</p>
              ) : (
                <>
                  <ul className="task-checkbox-list">
                    {tasks.map((task) => (
                      <li key={task.id}>
                        <label className="task-checkbox-item">
                          <input
                            type="checkbox"
                            checked={selectedTaskIds.has(task.id)}
                            onChange={() => toggleTask(task.id)}
                          />
                          <span>{task.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    className="task-save-btn"
                    onClick={handleSave}
                    disabled={saving || isFutureDate(selectedDate)}
                  >
                    {saving ? 'Saving…' : 'Save tasks'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {message && <p className="task-logger-message">{message}</p>}
      {error && <p className="task-logger-error" role="alert">{error}</p>}
    </section>
  )
}

export default TaskLogger
