import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDQ1IomTQstlswBNIUS9dpJt2-5cbA-qes",
  authDomain: "video-sheet.firebaseapp.com",
  projectId: "video-sheet",
  storageBucket: "video-sheet.firebasestorage.app",
  messagingSenderId: "1020120343780",
  appId: "1:1020120343780:web:ee5a2ef93590fe75baf8f1"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth();
