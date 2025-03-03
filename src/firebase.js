// Import Firebase SDK
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Firestore (CMS)
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // Firestore instance
const storage = getStorage(app); // Storage instance (if needed)

export { db, storage };
