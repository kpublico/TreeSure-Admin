// main.js
import { Controller } from "./controller.js";

// ✅ Ensure DOM is fully loaded before initializing
document.addEventListener("DOMContentLoaded", () => {
  // Expose Controller for inline onclick (if needed)
  window.Controller = Controller;

  // Initialize the Controller
  if (Controller.init) {
    Controller.init();
    console.log("✅ Controller initialized successfully.");
  } else {
    console.error("❌ Controller.init() is not defined.");
  }
});
