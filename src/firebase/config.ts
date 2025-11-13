import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyCmgIO1b3NU1h2eB7PzLutqHZ7tSqQvoFw",
  authDomain: "match-grader.firebaseapp.com",
  projectId: "match-grader",
  storageBucket: "match-grader.firebasestorage.app",
  messagingSenderId: "1003135092000",
  appId: "1:1003135092000:web:35ea4ec6c4c44cc8060345",
  measurementId: "G-4MNH7X2F8P"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth();
