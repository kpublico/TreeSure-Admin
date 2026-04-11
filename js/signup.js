import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBca-tYDQIXxSzOAz2jph3Mse6rJ3Ag9is",
  authDomain: "treesure-6496c.firebaseapp.com",
  databaseURL: "https://treesure-6496c-default-rtdb.firebaseio.com",
  projectId: "treesure-6496c",
  storageBucket: "treesure-6496c.firebasestorage.app",
  messagingSenderId: "324875915553",
  appId: "1:324875915553:web:9c8b1136a2d04594bcae60",
  measurementId: "G-G9V6QMHX1E"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function showMessage(message, type) {
  const messageBox = document.getElementById("signupMessage");
  if (!messageBox) {
    return;
  }

  messageBox.textContent = message;
  messageBox.classList.remove("hidden", "border-emerald-200", "bg-emerald-50", "text-emerald-800", "border-red-200", "bg-red-50", "text-red-700");

  if (type === "success") {
    messageBox.classList.add("border-emerald-200", "bg-emerald-50", "text-emerald-800");
  } else {
    messageBox.classList.add("border-red-200", "bg-red-50", "text-red-700");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signupForm");
  const passwordInput = document.getElementById("password");
  const togglePassword = document.getElementById("togglePassword");
  const eyeOpen = document.getElementById("eyeOpen");
  const eyeSlash = document.getElementById("eyeSlash");

  if (togglePassword && passwordInput && eyeOpen && eyeSlash) {
    togglePassword.addEventListener("click", () => {
      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        eyeOpen.style.display = "inline";
        eyeSlash.style.display = "none";
      } else {
        passwordInput.type = "password";
        eyeOpen.style.display = "none";
        eyeSlash.style.display = "inline";
      }
    });
  }

  signupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!fullName || !email || !password || !confirmPassword) {
      showMessage("Please complete all fields.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Passwords do not match.", "error");
      return;
    }

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: fullName });
      showMessage("Account created successfully. Redirecting to login...", "success");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1200);
    } catch (error) {
      showMessage(error.message, "error");
    }
  });
});
