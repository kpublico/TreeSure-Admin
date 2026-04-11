// js/controller.js
import { Model } from "./model.js";
import { View } from "./view.js";

export const Controller = {
  usersCache: [],
  unsubscribe: null,

  init(config = {}) {
    this.tableBodyId = config.tableBodyId || "usersTableBody";
    this.addFormId = config.addFormId || "addUserForm";
    this.searchInputId = config.searchInputId || "searchInput";
    this.collectionName = config.collectionName || "users";

    // init listeners
    this.setupAddForm();
    this.setupSearch();
    this.startListening();
  },

  setupAddForm() {
    const form = document.getElementById(this.addFormId);
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const newUser = {
        name: document.getElementById("name").value.trim(),
        username: document.getElementById("username").value.trim(),
        password: document.getElementById("password").value, // see note below
        contactNumber: document.getElementById("contactNumber").value.trim(),
        address: document.getElementById("address").value.trim(),
        role: document.getElementById("role").value,
        active: document.getElementById("active").value === "true"
      };

      try {
        await Model.add(this.collectionName, newUser);
        form.reset();
        // UI will update via realtime listener
      } catch (err) {
        console.error("Add user error:", err);
        alert("Error adding user: " + err.message);
      }
    });
  },

  setupSearch() {
    const input = document.getElementById(this.searchInputId);
    if (!input) return;

    input.addEventListener("input", (e) => {
      const filtered = View.filterUsers(this.usersCache, e.target.value);
      View.renderUsers(this.tableBodyId, filtered);
      this.attachRowDelegation(); // reattach handlers
    });
  },

  startListening() {
    // unsubscribe existing if exists
    if (this.unsubscribe) this.unsubscribe();

    this.unsubscribe = Model.listen(this.collectionName, (items) => {
      this.usersCache = items; // save master list
      const searchVal = document.getElementById(this.searchInputId)?.value || "";
      const toRender = View.filterUsers(items, searchVal);
      View.renderUsers(this.tableBodyId, toRender);
      this.attachRowDelegation();
    });
  },

  attachRowDelegation() {
    const tbody = document.getElementById(this.tableBodyId);
    if (!tbody) return;

    // Remove previous listener to prevent duplication
    tbody.onclick = (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.classList.contains("delete-btn")) {
        this.handleDelete(id);
      } else if (btn.classList.contains("edit-btn")) {
        this.handleEdit(id);
      }
    };
  },

  async handleDelete(id) {
    if (!confirm("Delete this user?")) return;
    try {
      await Model.delete(this.collectionName, id);
      // realtime listener will update the UI
    } catch (err) {
      console.error("Delete error:", err);
      alert("Error deleting user: " + err.message);
    }
  },

  async handleEdit(id) {
    // get current data
    const user = this.usersCache.find(u => u.id === id);
    if (!user) return alert("User not found");

    // simple modal-like prompt flow (you can replace with better UI)
    const name = prompt("Name:", user.name);
    if (name === null) return; // cancelled
    const username = prompt("Username:", user.username);
    if (username === null) return;
    const contactNumber = prompt("Contact Number:", user.contactNumber || "");
    if (contactNumber === null) return;
    const address = prompt("Address:", user.address || "");
    if (address === null) return;
    const role = prompt("Role:", user.role || "Admin");
    if (role === null) return;
    const active = confirm("Set as active? (OK = Active)");

    try {
      await Model.update(this.collectionName, id, {
        name, username, contactNumber, address, role, active
      });
      // realtime listener will update the UI
    } catch (err) {
      console.error("Update error:", err);
      alert("Error updating user: " + err.message);
    }
  }
};

