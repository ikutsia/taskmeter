import {
  addDoc,
  collection,
  deleteDoc,
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

const EXPECTED_CODES = new Set(DEFAULT_TASKS.map((task) => task.code))

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

async function deleteAllTasks() {
  const snapshot = await getDocs(collection(db, 'tasks'))
  await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)))
}

async function deleteUserCompletions(userId) {
  const snapshot = await getDocs(
    query(collection(db, 'completions'), where('userId', '==', userId)),
  )
  await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)))
}

async function seedDefaultTasks() {
  await Promise.all(
    DEFAULT_TASKS.map((task, index) =>
      addDoc(collection(db, 'tasks'), {
        code: task.code,
        name: task.name,
        order: index,
        active: true,
        createdAt: serverTimestamp(),
      }),
    ),
  )
}

function tasksNeedMigration(taskDocs) {
  if (taskDocs.length !== DEFAULT_TASKS.length) return true
  return taskDocs.some((item) => {
    const data = item.data()
    return !data.code || !EXPECTED_CODES.has(data.code)
  })
}

async function purgeLegacyCompletionsForCurrentUser() {
  const user = auth.currentUser
  if (!user) return

  const storageKey = `taskmeter_completions_purged_v${TASK_LIST_VERSION}_${user.uid}`
  if (localStorage.getItem(storageKey)) return

  await deleteUserCompletions(user.uid)
  localStorage.setItem(storageKey, '1')
}

export async function ensureDefaultTasks() {
  const user = auth.currentUser
  if (!user) return

  const taskSnapshot = await getDocs(collection(db, 'tasks'))
  const storedVersion = await getStoredTaskListVersion()
  const shouldMigrate =
    storedVersion < TASK_LIST_VERSION || tasksNeedMigration(taskSnapshot.docs)

  if (shouldMigrate) {
    await deleteAllTasks()
    await deleteUserCompletions(user.uid)
    await seedDefaultTasks()
    await setDoc(
      doc(db, 'settings', 'app'),
      { tasksVersion: TASK_LIST_VERSION },
      { merge: true },
    )
    localStorage.setItem(
      `taskmeter_completions_purged_v${TASK_LIST_VERSION}_${user.uid}`,
      '1',
    )
    return
  }

  await purgeLegacyCompletionsForCurrentUser()

  const existingCodes = new Set(taskSnapshot.docs.map((item) => item.data().code))
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
