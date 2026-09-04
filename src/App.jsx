import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase'
import LoginPage from './components/LoginPage'
import SharedCalendar from './components/SharedCalendar'
import TaskLogger from './components/TaskLogger'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setAuthReady(true)
      if (firebaseUser) {
        setShowLogin(false)
      }
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
        <div className="header-actions">
          {user ? (
            <>
              <span className="user-badge">{displayName}</span>
              <button type="button" className="logout-btn" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <button type="button" className="sign-in-btn" onClick={() => setShowLogin(true)}>
              Sign in
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        {!authReady ? (
          <p className="loading-text">Loading…</p>
        ) : (
          <div className="dashboard">
            {showLogin && !user && (
              <div className="auth-panel">
                <button
                  type="button"
                  className="auth-panel-close"
                  onClick={() => setShowLogin(false)}
                  aria-label="Close sign in"
                >
                  ×
                </button>
                <LoginPage />
              </div>
            )}

            {user && <TaskLogger user={user} />}
            <SharedCalendar user={user} />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
