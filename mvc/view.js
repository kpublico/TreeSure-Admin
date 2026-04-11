// js/view.js
export const View = {
  renderUsers(tableBodyId, users) {
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!users || users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#777">No users found</td></tr>`;
      return;
    }

    users.forEach(user => {
      const tr = document.createElement("tr");

      // Use nullish coalescing to avoid undefined
      const name = user.name ?? "N/A";
      const username = user.username ?? "N/A";
      const password = user.password ?? "N/A";
      const contact = user.contactNumber ?? "N/A";
      const address = user.address ?? "N/A";
      const role = user.role ?? "N/A";
      const status = user.active ? "Active" : "Inactive";

      tr.innerHTML = `
        <td>${name}</td>
        <td>${username}</td>
        <td>${password}</td>
        <td>${contact}</td>
        <td>${address}</td>
        <td>${role}</td>
        <td>${status}</td>
        <td>
          <button class="edit-btn" data-id="${user.id}">✏️ Edit</button>
          <button class="delete-btn" data-id="${user.id}">🗑️ Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  // optional small helper to filter and return items by a search term
  filterUsers(users, term) {
    if (!term) return users;
    const q = term.trim().toLowerCase();
    return users.filter(u => {
      return (u.name && u.name.toLowerCase().includes(q))
          || (u.username && u.username.toLowerCase().includes(q))
          || (u.contactNumber && u.contactNumber.toLowerCase().includes(q));
    });
  }
};
