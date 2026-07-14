import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import './LoginPage.css'

const FAMILY_MEMBERS = ['Irakli', 'Nino']

function getAuthErrorMessage(code) {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Try signing in instead.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'permission-denied':
      return 'Database access denied. Check your Firestore security rules.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

function LoginPage() {
  const [mode, setMode] = useState('signin')
  const [selectedMember, setSelectedMember] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    setSelectedMember('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')

    if (!selectedMember) {
      setError('Please select who you are.')
      return
    }

    if (!email.trim()) {
      setError('Please enter your email.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(user, { displayName: selectedMember })

      const nameQuery = query(
        collection(db, 'members'),
        where('name', '==', selectedMember),
      )
      const existing = await getDocs(nameQuery)

      if (!existing.empty) {
        await deleteUser(user)
        setError(`${selectedMember} already has an account. Please sign in.`)
        return
      }

      await addDoc(collection(db, 'members'), {
        uid: user.uid,
        name: selectedMember,
        email: user.email,
        createdAt: serverTimestamp(),
      })
    } catch (err) {
      console.error('Sign up error:', err.code, err.message)
      setError(getAuthErrorMessage(err.code))
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = async (e) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Please enter your email.')
      return
    }

    if (!password.trim()) {
      setError('Please enter your password.')
      return
    }

    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setError(getAuthErrorMessage(err.code))
    } finally {
      setLoading(false)
    }
  }

  const isSignUp = mode === 'signup'

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="mode-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isSignUp}
            className={`mode-btn ${!isSignUp ? 'active' : ''}`}
            onClick={() => switchMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignUp}
            className={`mode-btn ${isSignUp ? 'active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            Sign up
          </button>
        </div>

        <h2 className="login-heading">{isSignUp ? 'Create account' : 'Welcome back'}</h2>
        <p className="login-subheading">
          {isSignUp
            ? 'Choose your name and set your own email and password.'
            : 'Sign in with the email and password you created.'}
        </p>

        <form
          className="login-form"
          onSubmit={isSignUp ? handleSignUp : handleSignIn}
        >
          {isSignUp && (
            <fieldset className="member-select">
              <legend>Who are you?</legend>
              <div className="member-options">
                {FAMILY_MEMBERS.map((name) => (
                  <label
                    key={name}
                    className={`member-option ${selectedMember === name ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="member"
                      value={name}
                      checked={selectedMember === name}
                      onChange={(e) => setSelectedMember(e.target.value)}
                    />
                    <span className="member-name">{name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <label className="form-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignUp ? 'At least 6 characters' : 'Enter password'}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </label>

          {isSignUp && (
            <label className="form-field">
              <span>Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
              />
            </label>
          )}

          {error && <p className="login-error" role="alert">{error}</p>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
