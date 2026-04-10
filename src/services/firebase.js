import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBOBvFJhvWwicICtr2VImwIpZQKnzWcM38",
  authDomain: "pontocdo-88e84.firebaseapp.com",
  projectId: "pontocdo-88e84",
  storageBucket: "pontocdo-88e84.firebasestorage.app",
  messagingSenderId: "1091178063560",
  appId: "1:1091178063560:web:76965602e77898f1a527fd",
  measurementId: "G-K1FMQ50P8G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, analytics, auth, db };
