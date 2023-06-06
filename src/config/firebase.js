import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, TwitterAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
//import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyBZ5O1nyaDKZSN9iys7iVjKtuTg1hJnaKo",
    authDomain: "lyricend-6b31f.firebaseapp.com",
    projectId: "lyricend-6b31f",
    storageBucket: "lyricend-6b31f.appspot.com",
    messagingSenderId: "564903769846",
    appId: "1:564903769846:web:6a626df00fff42cf235ed7",
    measurementId: "G-J3LVJ1Y0QP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const twitterProvider = new TwitterAuthProvider();
export const db = getFirestore(app)
//const analytics = getAnalytics(app);