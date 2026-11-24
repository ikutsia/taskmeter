import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendPasswordResetEmail,
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

function getAuthErrorMessage(code, context = 'signin') {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Try signing in instead.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Incorrect email or password.'
    case 'auth/user-not-found':
      return context === 'reset'
        ? 'No account found for this email. Check the address or sign up.'
        : 'Incorrect email or password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/missing-email':
      return 'Please enter your email.'
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
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    setInfo('')
    setSelectedMember('')
    setPassword('')
    setConfirmPassword('')
    if (nextMode === 'signup' || mode === 'signup') {
      setEmail('')
    }
  }

  const openReset = () => {
    setMode('reset')
    setError('')
    setInfo('')
    setPassword('')
    setConfirmPassword('')
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')

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
    setInfo('')

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

  const handleReset = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')

    if (!email.trim()) {
      setError('Please enter your email.')
      return
    }

    setLoading(true)

    try {
      await sendPasswordResetEmail(auth, email.trim())
      setInfo('Check your inbox for a reset link. Then come back here to sign in.')
    } catch (err) {
      setError(getAuthErrorMessage(err.code, 'reset'))
    } finally {
      setLoading(false)
    }
  }

  const isSignUp = mode === 'signup'
  const isReset = mode === 'reset'

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

        <h2 className="login-heading">
          {isSignUp ? 'Create account' : isReset ? 'Reset password' : 'Welcome back'}
        </h2>
        <p className="login-subheading">
          {isSignUp
            ? 'Choose your name and set your own email and password.'
            : isReset
              ? 'Enter the email you signed up with. We will send a reset link.'
              : 'Sign in with the email and password you created.'}
        </p>

        <form
          className="login-form"
          onSubmit={isSignUp ? handleSignUp : isReset ? handleReset : handleSignIn}
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

          {!isReset && (
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
          )}

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

          {!isSignUp && !isReset && (
            <button type="button" className="forgot-password-btn" onClick={openReset}>
              Forgot password?
            </button>
          )}

          {error && <p className="login-error" role="alert">{error}</p>}
          {info && <p className="login-info" role="status">{info}</p>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading
              ? 'Please wait…'
              : isSignUp
                ? 'Create account'
                : isReset
                  ? 'Send reset email'
                  : 'Sign in'}
          </button>

          {isReset && (
            <button
              type="button"
              className="back-to-signin-btn"
              onClick={() => switchMode('signin')}
            >
              Back to sign in
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

export default LoginPage
