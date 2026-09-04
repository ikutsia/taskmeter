import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { isEditableDate } from './dates'

export const MAX_NOTE_LENGTH = 500

export async function getNoteForUserDate(userId, date) {
  const q = query(
    collection(db, 'notes'),
    where('userId', '==', userId),
    where('date', '==', date),
  )
  const snapshot = await getDocs(q)

  if (snapshot.empty) return null

  const item = snapshot.docs[0]
  return { id: item.id, ...item.data() }
}

export async function saveNoteForDate(user, date, text) {
  if (!isEditableDate(date)) {
    throw new Error('INVALID_EDIT_DATE')
  }

  const trimmed = text.trim()
  const existing = await getNoteForUserDate(user.uid, date)

  if (!trimmed) {
    if (existing) {
      await deleteDoc(doc(db, 'notes', existing.id))
    }
    return
  }

  if (trimmed.length > MAX_NOTE_LENGTH) {
    throw new Error('NOTE_TOO_LONG')
  }

  if (existing) {
    await updateDoc(doc(db, 'notes', existing.id), {
      text: trimmed,
      userName: user.displayName || user.email,
      updatedAt: serverTimestamp(),
    })
    return
  }

  await addDoc(collection(db, 'notes'), {
    userId: user.uid,
    userName: user.displayName || user.email,
    date,
    text: trimmed,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteNoteForUser(user, note) {
  if (!user || note.userId !== user.uid) {
    throw new Error('NOT_OWNER')
  }

  if (!isEditableDate(note.date)) {
    throw new Error('INVALID_EDIT_DATE')
  }

  await deleteDoc(doc(db, 'notes', note.id))
}

export function subscribeToNoteForUserDate(userId, date, onNote, onError) {
  const q = query(
    collection(db, 'notes'),
    where('userId', '==', userId),
    where('date', '==', date),
  )

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onNote(null)
        return
      }
      const item = snapshot.docs[0]
      onNote({ id: item.id, ...item.data() })
    },
    onError,
  )
}

export function subscribeToNotesInRange(startDate, endDate, onNotes, onError) {
  const q = query(
    collection(db, 'notes'),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
  )

  return onSnapshot(
    q,
    (snapshot) => {
      const notes = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }))
      onNotes(notes)
    },
    onError,
  )
}

export function groupNotesByDate(notes) {
  const grouped = {}

  for (const note of notes) {
    if (!note.text?.trim()) continue

    if (!grouped[note.date]) {
      grouped[note.date] = {}
    }

    grouped[note.date][note.userName || 'Unknown'] = {
      id: note.id,
      userId: note.userId,
      date: note.date,
      text: note.text.trim(),
    }
  }

  return grouped
}
