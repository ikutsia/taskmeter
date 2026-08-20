import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase'
import LoginPage from './components/LoginPage'
import TaskList from './components/TaskList'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setAuthReady(true)
    })
    return unsubscribe
  }, [])

  const handleLogout = async () => {
    await signOut(auth)
  }

  const displayName = user?.displayName || user?.email

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">taskmeter</h1>
        {user && (
          <div className="header-user">
            <span className="user-badge">{displayName}</span>
            <button type="button" className="logout-btn" onClick={handleLogout}>
              Log out
            </button>
          </div>
        )}
      </header>

      <main className="app-main">
        {!authReady ? (
          <p className="loading-text">Loading…</p>
        ) : user ? (
          <TaskList userName={displayName} />
        ) : (
          <LoginPage />
        )}
      </main>
    </div>
  )
}

export default App
