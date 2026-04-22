import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, checkLogin } from "./script.js";

checkLogin();

const loadingMessage = document.getElementById("loadingMessage");
const tableBody = document.getElementById("treesTableBody");
const searchInput = document.getElementById("treeSearchInput");

const appointmentsRef = collection(db, "appointments");
let allTrees = [];

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderRows(rows) {
  tableBody.innerHTML = "";

  if (!rows.length) {
    tableBody.innerHTML =
      '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-500">No trees data available.</td></tr>';
    return;
  }

  rows.forEach((tree) => {
    const row = document.createElement("tr");
    row.className = "transition hover:bg-slate-50";

    const treeId = tree.treeNo || tree.treeId || "N/A";
    const species = tree.species || "N/A";
    const location = tree.location || "N/A";
    const height = tree.height ?? "N/A";
    const dbh = tree.diameter || "N/A";
    const forester = tree.forester || "Unknown Forester";
    const status = tree.status || "Pending";

    row.innerHTML = `
      <td class="px-4 py-3 font-semibold text-slate-700">${escapeHtml(treeId)}</td>
      <td class="px-4 py-3">${escapeHtml(species)}</td>
      <td class="px-4 py-3">${escapeHtml(location)}</td>
      <td class="px-4 py-3">${escapeHtml(height)}</td>
      <td class="px-4 py-3">${escapeHtml(dbh)}</td>
      <td class="px-4 py-3">${escapeHtml(forester)}</td>
      <td class="px-4 py-3">
        <span class="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">${escapeHtml(status)}</span>
      </td>
    `;

    tableBody.appendChild(row);
  });
}

function applySearchFilter() {
  const keyword = (searchInput?.value || "").toLowerCase().trim();

  if (!keyword) {
    renderRows(allTrees);
    return;
  }

  const filtered = allTrees.filter((tree) => {
    const haystack = [
      tree.treeNo,
      tree.treeId,
      tree.species,
      tree.location,
      tree.forester,
      tree.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(keyword);
  });

  renderRows(filtered);
}

async function loadTrees() {
  loadingMessage.style.display = "block";

  try {
    const appointmentsSnap = await getDocs(appointmentsRef);

    if (appointmentsSnap.empty) {
      loadingMessage.style.display = "none";
      tableBody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-500">No appointments found in Firestore.</td></tr>';
      return;
    }

    for (const appointmentDoc of appointmentsSnap.docs) {
      const appointmentData = appointmentDoc.data();
      const appointmentId = appointmentDoc.id;

      let applicantName = "Unknown";
      const applicantId = appointmentData.applicantId;
      if (applicantId) {
        try {
          const userDocRef = doc(db, "users", applicantId);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            applicantName = userDocSnap.data().name || "Unknown";
          }
        } catch (err) {
          console.warn("Could not fetch user name for ID:", applicantId, err);
        }
      }

      const treeInventoryRef = collection(db, `appointments/${appointmentId}/tree_inventory`);
      const treeInventorySnap = await getDocs(treeInventoryRef);

      treeInventorySnap.forEach((treeDoc) => {
        const treeData = treeDoc.data();
        allTrees.push({
          treeId: treeDoc.id,
          treeNo: treeData.tree_no || treeData.tree_id || treeDoc.id,
          species: treeData.specie || treeData.species || "Unknown",
          location: appointmentData.location || treeData.location || treeData.municipality || treeData.barangay || "N/A",
          height: treeData.height ?? "N/A",
          diameter: treeData.diameter || treeData.dbh || "N/A",
          forester: treeData.forester_name || "Unknown Forester",
          status: appointmentData.status || "Pending",
          applicantName,
        });
      });
    }

    loadingMessage.style.display = "none";
    if (allTrees.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-500">No trees found in any appointment inventory.</td></tr>';
    } else {
      renderRows(allTrees);
    }
  } catch (err) {
    console.error("Error loading tree records:", err);
    loadingMessage.style.display = "none";
    tableBody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-rose-600">Error loading tree records: ${escapeHtml(err.message)}</td></tr>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadTrees();
  searchInput?.addEventListener("input", applySearchFilter);
});
