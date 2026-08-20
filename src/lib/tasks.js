import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { DEFAULT_TASKS } from '../constants/defaultTasks'

export async function ensureDefaultTasks() {
  const snapshot = await getDocs(collection(db, 'tasks'))
  const existingNames = new Set(snapshot.docs.map((doc) => doc.data().name))

  const missingTasks = DEFAULT_TASKS.filter((name) => !existingNames.has(name))

  await Promise.all(
    missingTasks.map((name) =>
      addDoc(collection(db, 'tasks'), {
        name,
        active: true,
        createdAt: serverTimestamp(),
      }),
    ),
  )
}

export function subscribeToActiveTasks(onTasks, onError) {
  const q = query(collection(db, 'tasks'), where('active', '==', true))

  return onSnapshot(
    q,
    (snapshot) => {
      const tasks = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => a.name.localeCompare(b.name))
      onTasks(tasks)
    },
    onError,
  )
}
