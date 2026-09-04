import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import { DEFAULT_TASKS, TASK_LIST_VERSION } from '../constants/defaultTasks'

export function formatTaskLabel(task) {
  if (!task?.code) return task?.name || ''
  if (!task?.name) return task.code
  return `${task.code} – ${task.name}`
}

export function formatTaskDropdownLabel(task) {
  return formatTaskLabel(task)
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

async function getStoredTaskListVersion() {
  const snapshot = await getDoc(doc(db, 'settings', 'app'))
  return snapshot.exists() ? snapshot.data().tasksVersion ?? 1 : 1
}

async function addMissingDefaultTasks(existingCodes) {
  const missingTasks = DEFAULT_TASKS.filter((task) => !existingCodes.has(task.code))

  await Promise.all(
    missingTasks.map((task) => {
      const order = DEFAULT_TASKS.findIndex((item) => item.code === task.code)
      return addDoc(collection(db, 'tasks'), {
        code: task.code,
        name: task.name,
        order,
        active: true,
        createdAt: serverTimestamp(),
      })
    }),
  )
}

export async function ensureDefaultTasks() {
  const user = auth.currentUser
  if (!user) return

  const taskSnapshot = await getDocs(collection(db, 'tasks'))
  const existingCodes = new Set(taskSnapshot.docs.map((item) => item.data().code).filter(Boolean))
  const storedVersion = await getStoredTaskListVersion()

  await addMissingDefaultTasks(existingCodes)

  if (storedVersion < TASK_LIST_VERSION) {
    await setDoc(
      doc(db, 'settings', 'app'),
      { tasksVersion: TASK_LIST_VERSION },
      { merge: true },
    )
  }
}

export function subscribeToActiveTasks(onTasks, onError) {
  const q = query(collection(db, 'tasks'), where('active', '==', true))

  return onSnapshot(
    q,
    (snapshot) => {
      onTasks(sortTasks(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))))
    },
    onError,
  )
}
