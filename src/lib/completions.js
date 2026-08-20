import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { isFutureDate } from './dates'

export async function getCompletionsForUserDate(userId, date) {
  const q = query(
    collection(db, 'completions'),
    where('userId', '==', userId),
    where('date', '==', date),
  )
  const snapshot = await getDocs(q)

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }))
}

export async function saveCompletionsForDate(user, date, selectedTasks) {
  if (isFutureDate(date)) {
    throw new Error('FUTURE_DATE')
  }

  const existing = await getCompletionsForUserDate(user.uid, date)
  const existingByTaskId = new Map(existing.map((item) => [item.taskId, item]))
  const selectedIds = new Set(selectedTasks.map((task) => task.id))

  const deletions = existing
    .filter((item) => !selectedIds.has(item.taskId))
    .map((item) => deleteDoc(doc(db, 'completions', item.id)))

  const additions = selectedTasks
    .filter((task) => !existingByTaskId.has(task.id))
    .map((task) =>
      addDoc(collection(db, 'completions'), {
        userId: user.uid,
        userName: user.displayName || user.email,
        taskId: task.id,
        taskName: task.name,
        date,
        completedAt: serverTimestamp(),
      }),
    )

  await Promise.all([...deletions, ...additions])
}

export function subscribeToCompletionsInRange(startDate, endDate, onCompletions, onError) {
  const q = query(
    collection(db, 'completions'),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
  )

  return onSnapshot(
    q,
    (snapshot) => {
      const completions = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }))
      onCompletions(completions)
    },
    onError,
  )
}

export function groupCompletionsByDate(completions) {
  const grouped = {}

  for (const completion of completions) {
    if (!grouped[completion.date]) {
      grouped[completion.date] = {}
    }

    const userName = completion.userName || 'Unknown'
    if (!grouped[completion.date][userName]) {
      grouped[completion.date][userName] = []
    }

    grouped[completion.date][userName].push(completion.taskName)
  }

  for (const date of Object.keys(grouped)) {
    for (const userName of Object.keys(grouped[date])) {
      grouped[date][userName].sort((a, b) => a.localeCompare(b))
    }
  }

  return grouped
}
