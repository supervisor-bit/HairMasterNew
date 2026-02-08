import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCLk0A5m1UL3P8_l3L0cvsa_SIqVAxpmHc",
  authDomain: "kadernictvi-app.firebaseapp.com",
  projectId: "kadernictvi-app",
  storageBucket: "kadernictvi-app.firebasestorage.app",
  messagingSenderId: "492480227328",
  appId: "1:492480227328:web:23814e0a9a30fdb0ecd0e5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with persistent cache (new API)
// Uses a unique cache name to avoid conflicts with old SDK versions
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: 40 * 1024 * 1024 // 40 MB
  })
});

export const auth = getAuth(app);
