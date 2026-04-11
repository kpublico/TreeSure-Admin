console.log("✅ settings.js loaded");

document.addEventListener("DOMContentLoaded", () => {

  const APPEARANCE_KEY = "treesure_appearance_settings";

  function formatDateByPreference(date, format) {
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    if (format === "dmy") return `${d}/${m}/${y}`;
    if (format === "iso") return `${y}-${m}-${d}`;
    return `${m}/${d}/${y}`;
  }

  function getAppearanceSettings() {
    try {
      const stored = localStorage.getItem(APPEARANCE_KEY);
      if (!stored) {
        return { theme: "light", density: "comfortable", dateFormat: "mdy" };
      }
      const parsed = JSON.parse(stored);
      return {
        theme: parsed.theme || "light",
        density: parsed.density || "comfortable",
        dateFormat: parsed.dateFormat || "mdy"
      };
    } catch {
      return { theme: "light", density: "comfortable", dateFormat: "mdy" };
    }
  }

  function applyAppearanceSettings(settings) {
    document.body.classList.toggle("appearance-dark", settings.theme === "dark");
    document.body.classList.toggle("density-compact", settings.density === "compact");

    const lastUpdateEl = document.getElementById("lastUpdateText");
    if (lastUpdateEl) {
      lastUpdateEl.textContent = formatDateByPreference(new Date(), settings.dateFormat);
    }
  }

  function saveAppearanceSettings(settings) {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(settings));
  }

  function openModal(modal) {
    if (modal) modal.style.display = "flex";
  }

  // ---------- GLOBAL MESSAGE MODAL ----------
  function showMessage(message, type = "success") {
    const messageModal = document.getElementById("messageModal");
    const messageText = document.getElementById("messageText");
    const messageIcon = document.getElementById("messageIcon");

    messageText.textContent = message;
    messageModal.classList.remove("message-success", "message-error");

    if (type === "success") {
      messageModal.classList.add("message-success");
      messageIcon.innerHTML = '<i class="fa fa-check-circle"></i>';
    } else {
      messageModal.classList.add("message-error");
      messageIcon.innerHTML = '<i class="fa fa-times-circle"></i>';
    }

    messageModal.style.display = "block";

    setTimeout(() => {
      messageModal.style.display = "none";
    }, 2000);
  }

  // ---------- MODAL LOGIC ----------
  const modals = {
    changePassword: document.getElementById("changePasswordModal"),
    manageAdmins: document.getElementById("manageAdminsModal"),
    profile: document.getElementById("profilePreferencesModal"),
    appearance: document.getElementById("appearanceModal")
  };

  const buttons = {
    changePassword: document.getElementById("changePasswordBtn"),
    manageAdmins: document.getElementById("manageAdminsBtn"),
    profile: document.getElementById("profilePreferencesBtn"),
    appearance: document.getElementById("appearanceBtn")
  };

  const appearanceTheme = document.getElementById("appearanceTheme");
  const appearanceDensity = document.getElementById("appearanceDensity");
  const appearanceDateFormat = document.getElementById("appearanceDateFormat");
  const saveAppearanceBtn = document.getElementById("saveAppearanceBtn");

  const initialAppearance = getAppearanceSettings();
  if (appearanceTheme) appearanceTheme.value = initialAppearance.theme;
  if (appearanceDensity) appearanceDensity.value = initialAppearance.density;
  if (appearanceDateFormat) appearanceDateFormat.value = initialAppearance.dateFormat;
  applyAppearanceSettings(initialAppearance);

  saveAppearanceBtn?.addEventListener("click", () => {
    const settings = {
      theme: appearanceTheme?.value || "light",
      density: appearanceDensity?.value || "comfortable",
      dateFormat: appearanceDateFormat?.value || "mdy"
    };

    saveAppearanceSettings(settings);
    applyAppearanceSettings(settings);
    modals.appearance.style.display = "none";
    showMessage("Appearance updated successfully!", "success");
  });

  const closeButtons = document.querySelectorAll(".modal .close");

  // Close modals when clicking X
  closeButtons.forEach(btn => {
    const modalId = btn.getAttribute("data-close");
    btn.addEventListener("click", () => {
      document.getElementById(modalId).style.display = "none";

      // Clear inputs on close
      if (modalId === "changePasswordModal") {
        document.getElementById("currentPassword").value = "";
        document.getElementById("newPassword").value = "";
        document.getElementById("confirmPassword").value = "";
      }
      if (modalId === "manageAdminsModal") {
        document.getElementById("newAdminEmail").value = "";
        document.getElementById("newAdminPassword").value = "";
      }
    });
  });

  // Close modal when clicking outside
  window.addEventListener("click", e => {
    Object.values(modals).forEach(modal => {
      if (e.target === modal) modal.style.display = "none";
    });
  });

  // ---------- FIREBASE AUTH ----------
  let currentUser = null;

  firebase.auth().onAuthStateChanged(user => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    currentUser = user; // store user globally

    // ---------- OPEN MODALS ----------
    buttons.changePassword?.addEventListener("click", () => openModal(modals.changePassword));
    buttons.manageAdmins?.addEventListener("click", () => {
      openModal(modals.manageAdmins);
      loadAdmins?.(); // optional function to load admin list
    });
   buttons.profile?.addEventListener("click", () => {
  console.log("Current User:", currentUser);
  openModal(modals.profile);
  document.getElementById("adminEmail").value = currentUser?.email || "";
});
    buttons.appearance?.addEventListener("click", () => {
      const current = getAppearanceSettings();
      if (appearanceTheme) appearanceTheme.value = current.theme;
      if (appearanceDensity) appearanceDensity.value = current.density;
      if (appearanceDateFormat) appearanceDateFormat.value = current.dateFormat;
      openModal(modals.appearance);
    });

    // ---------- CHANGE PASSWORD ----------
  // ---------- CHANGE PASSWORD ----------
const savePasswordBtn = document.getElementById("savePasswordBtn");
savePasswordBtn?.addEventListener("click", async () => {
  const currentPassword = document.getElementById("currentPassword").value.trim();
  const newPassword = document.getElementById("newPassword").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();

  if (!currentPassword || !newPassword || !confirmPassword)
    return showMessage("Please fill all fields", "error");

  if (newPassword !== confirmPassword)
    return showMessage("Passwords do not match", "error");

  if (newPassword.length < 6)
    return showMessage("Password must be at least 6 characters", "error");

  try {
    const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, currentPassword);
    await currentUser.reauthenticateWithCredential(credential);
    await currentUser.updatePassword(newPassword);

    showMessage("Password updated successfully!", "success");

    // Remove this line so modal stays open
    // modals.changePassword.style.display = "none";

    // Optionally, clear only the input fields
    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("confirmPassword").value = "";
  } catch (err) {
    showMessage(err.message, "error");
  }
});


    // ---------- MANAGE ADMINS ----------
    const addAdminBtn = document.getElementById("addAdminBtn");
    addAdminBtn?.addEventListener("click", async () => {
      const email = document.getElementById("newAdminEmail").value.trim();
      const password = document.getElementById("newAdminPassword").value.trim();

      if (!email || !password)
        return showMessage("Please enter email and password", "error");

      if (password.length < 6)
        return showMessage("Password must be at least 6 characters", "error");

      try {
        const secondaryApp = firebase.initializeApp(firebase.app().options, "Secondary");
        await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
        showMessage("Admin added successfully!", "success");

        document.getElementById("newAdminEmail").value = "";
        document.getElementById("newAdminPassword").value = "";

        await secondaryApp.delete();
      } catch (err) {
        showMessage(err.message, "error");
      }
    });
  });

});
