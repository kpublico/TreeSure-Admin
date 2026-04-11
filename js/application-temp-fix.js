// Global helper functions for pages that can't use ES6 modules in inline scripts
// This file provides backwards compatibility for pages using onload="checkLogin()"

// Import and expose checkLogin globally
import { checkLogin as _checkLogin, logout as _logout } from "./script.js";

// Expose checkLogin globally so it can be called from onload attributes
window.checkLogin = _checkLogin;
window.logout = _logout;

// Track if listeners are already attached to prevent duplicates
let sidebarListenersAttached = false;

// Function to attach listeners once sidebar is loaded
window.attachSidebarListeners = function() {
  // Prevent attaching listeners multiple times
  if (sidebarListenersAttached) {
    console.log("⚠️ Sidebar listeners already attached, skipping...");
    return;
  }

  const ctpoBtn = document.getElementById("ctpoBtn");
  const pltpBtn = document.getElementById("pltpBtn");
  const spltpBtn = document.getElementById("spltpBtn");
  const permitCutBtn = document.getElementById("permitCutBtn");
  const cttBtn = document.getElementById("cttBtn");
  const chainsawBtn = document.getElementById("chainsawBtn");

  function handleAppButtonClick(type, title) {
    const appTypeTitle = document.getElementById("applicationTypeTitle");
    if (appTypeTitle) {
      appTypeTitle.textContent = title;
    }
    
    // Call the globally exposed loadApplicants function
    if (window.loadApplicants) {
      window.loadApplicants(type);
    } else {
      console.error("loadApplicants function not found!");
    }
  }

  ctpoBtn?.addEventListener("click", () => {
    console.log("CTPO button clicked");
    handleAppButtonClick("ctpo", "CTPO Applications");
  });
  pltpBtn?.addEventListener("click", () => {
    console.log("PLTP button clicked");
    handleAppButtonClick("pltp", "PLTP Applications");
  });
  spltpBtn?.addEventListener("click", () => {
    console.log("SPLTP button clicked");
    handleAppButtonClick("splt", "SPLTP Applications");
  });
  permitCutBtn?.addEventListener("click", () => {
    console.log("Permit to Cut button clicked");
    handleAppButtonClick("ptc", "Permit to Cut Applications");
  });
  cttBtn?.addEventListener("click", () => {
    console.log("CTT button clicked");
    handleAppButtonClick("ctt", "Certificate to Travel Applications");
  });
  chainsawBtn?.addEventListener("click", () => {
    console.log("Chainsaw button clicked");
    handleAppButtonClick("chainsaw", "Chainsaw Permit Applications");
  });

  sidebarListenersAttached = true;
  console.log("✅ Sidebar event listeners attached successfully!");
  console.log("Found buttons:", { ctpoBtn, pltpBtn, spltpBtn, permitCutBtn, cttBtn, chainsawBtn });
};

// Listen for the custom event
document.addEventListener("sidebarLoaded", window.attachSidebarListeners);
