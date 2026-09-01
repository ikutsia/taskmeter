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
import { isEditableDate } from './dates'

export function getOccurrenceFromTaskCode(taskCode, baseCode) {
  if (taskCode === baseCode) return 1
  if (taskCode.startsWith(baseCode)) {
    const suffix = taskCode.slice(baseCode.length)
    if (/^\d+$/.test(suffix)) {
      return Number.parseInt(suffix, 10)
    }
  }
  return 1
}

export function getTaskCodeForOccurrence(baseCode, occurrence) {
  if (occurrence <= 1) return baseCode
  return `${baseCode}${occurrence}`
}

export function getNextTaskCode(existingForTask, baseCode) {
  if (existingForTask.length === 0) {
    return getTaskCodeForOccurrence(baseCode, 1)
  }

  const maxOccurrence = Math.max(
    ...existingForTask.map((item) => getOccurrenceFromTaskCode(item.taskCode, baseCode)),
  )

  return getTaskCodeForOccurrence(baseCode, maxOccurrence + 1)
}

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
  if (!isEditableDate(date)) {
    throw new Error('INVALID_EDIT_DATE')
  }

  if (selectedTasks.length === 0) {
    return
  }

  const existing = await getCompletionsForUserDate(user.uid, date)

  await Promise.all(
    selectedTasks.map(async (task) => {
      const existingForTask = existing.filter((item) => item.taskId === task.id)
      const taskCode = getNextTaskCode(existingForTask, task.code)

      await Promise.all(
        existingForTask.map((item) => deleteDoc(doc(db, 'completions', item.id))),
      )

      await addDoc(collection(db, 'completions'), {
        userId: user.uid,
        userName: user.displayName || user.email,
        taskId: task.id,
        taskCode,
        taskName: task.name,
        date,
        completedAt: serverTimestamp(),
      })
    }),
  )
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
    if (!completion.taskCode) continue

    if (!grouped[completion.date]) {
      grouped[completion.date] = {}
    }

    const userName = completion.userName || 'Unknown'
    if (!grouped[completion.date][userName]) {
      grouped[completion.date][userName] = []
    }

    grouped[completion.date][userName].push({
      code: completion.taskCode,
      name: completion.taskName,
    })
  }

  for (const date of Object.keys(grouped)) {
    for (const userName of Object.keys(grouped[date])) {
      grouped[date][userName].sort((a, b) => a.code.localeCompare(b.code))
    }
  }

  return grouped
}
