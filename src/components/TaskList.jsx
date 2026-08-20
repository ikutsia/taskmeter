import { useEffect, useState } from 'react'
import { ensureDefaultTasks, subscribeToActiveTasks } from '../lib/tasks'
import './TaskList.css'

function TaskList({ userName }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let unsubscribe = () => {}

    async function loadTasks() {
      try {
        await ensureDefaultTasks()
        unsubscribe = subscribeToActiveTasks(
          (nextTasks) => {
            setTasks(nextTasks)
            setLoading(false)
          },
          (err) => {
            console.error('Failed to load tasks:', err)
            setError('Could not load tasks. Please try again.')
            setLoading(false)
          },
        )
      } catch (err) {
        console.error('Failed to seed tasks:', err)
        setError('Could not load tasks. Please try again.')
        setLoading(false)
      }
    }

    loadTasks()
    return () => unsubscribe()
  }, [])

  if (loading) {
    return <p className="task-list-loading">Loading tasks…</p>
  }

  if (error) {
    return <p className="task-list-error" role="alert">{error}</p>
  }

  return (
    <div className="task-list">
      <div className="task-list-header">
        <h2>Household tasks</h2>
        <p>Hi {userName}, check off what you complete today.</p>
      </div>

      <ul className="task-items">
        {tasks.map((task) => (
          <li key={task.id} className="task-item">
            <span className="task-name">{task.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default TaskList
