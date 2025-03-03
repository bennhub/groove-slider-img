// Import Firebase SDK
import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // Storage (optional)

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAlv8DyWdhTjJjZYPqkghZUyEupG5g8SFk",
  authDomain: "groove-slider.firebaseapp.com",
  projectId: "groove-slider",
  storageBucket: "groove-slider.appspot.com",
  messagingSenderId: "87433841566",
  appId: "1:87433841566:web:da11fb420a121cc700248f",
  measurementId: "G-X0QJM954YF"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Enable offline persistence with IndexedDB (new method)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

const storage = getStorage(app); // Storage instance (if needed)

export { db, storage };
