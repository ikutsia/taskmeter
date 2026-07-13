# taskmeter

A household task tracker for Irakli and Nino.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in your Firebase config
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Firebase setup

### 1. Create project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a project named **taskmeter**
3. Register a **Web app** and copy the `firebaseConfig` values into `.env`

### 2. Enable Authentication

1. **Build → Authentication → Get started**
2. Enable **Email/Password** sign-in method
3. Do **not** manually create users — Irakli and Nino sign up themselves in the app

### 3. Create Firestore

1. **Build → Firestore Database → Create database**
2. Start in **Production mode**
3. Paste these security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    match /members/{memberId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn()
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.name in ['Irakli', 'Nino'];
      allow update, delete: if false;
    }

    match /tasks/{taskId} {
      allow read, write: if isSignedIn();
    }

    match /completions/{completionId} {
      allow read, write: if isSignedIn();
    }
  }
}
```

### 4. How sign-up works

- **Irakli** opens the app → **Sign up** → picks "Irakli" → chooses his own email & password
- **Nino** does the same with her own email & password
- Each name can only be registered once (stored in the `members` collection)

### 5. Netlify deployment

Add the same `VITE_FIREBASE_*` variables in **Netlify → Site configuration → Environment variables**, then add your Netlify domain under **Firebase → Authentication → Settings → Authorized domains**.

## Build

```bash
npm run build
```

The `dist` folder is ready for Netlify deployment.
