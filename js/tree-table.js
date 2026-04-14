import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, checkLogin } from "./script.js";

checkLogin();

const loadingMessage = document.getElementById("loadingMessage");
const tableBody = document.getElementById("treesTableBody");
const searchInput = document.getElementById("treeSearchInput");

const inventoryCache = {};
let allTrees = [];

async function fetchUserTrees(userId) {
  if (inventoryCache[userId]) return inventoryCache[userId];

  const inventoryRef = collection(db, `users/${userId}/tree_inventory`);
  const treesSnapshot = await getDocs(inventoryRef);

  const trees = treesSnapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  inventoryCache[userId] = trees;
  return trees;
}

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

    const treeId = tree.tree_no || tree.tree_id || tree.id || "N/A";
    const species = tree.specie || tree.species || "N/A";
    const location = tree.location || tree.municipality || tree.barangay || "N/A";
    const height = tree.height ?? "N/A";
    const dbh = tree.diameter ?? tree.dbh ?? "N/A";
    const forester = tree.forester_name || tree.foresterName || "Unknown Forester";
    const status = tree.tree_status || tree.status || "Active";

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
      tree.tree_no,
      tree.tree_id,
      tree.id,
      tree.specie,
      tree.species,
      tree.location,
      tree.municipality,
      tree.barangay,
      tree.forester_name,
      tree.foresterName,
      tree.tree_status,
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
    const usersSnapshot = await getDocs(collection(db, "users"));

    if (usersSnapshot.empty) {
      loadingMessage.style.display = "none";
      tableBody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-500">No users found in Firestore. Please add users and tree data.</td></tr>';
      return;
    }

    const treePromises = usersSnapshot.docs.map(async (userDoc) => {
      const trees = await fetchUserTrees(userDoc.id);
      return trees.map((tree) => ({
        ...tree,
        applicantName: tree.applicantName || userDoc.data().name || "Unknown Applicant",
      }));
    });

    allTrees = (await Promise.all(treePromises)).flat();

    loadingMessage.style.display = "none";
    if (allTrees.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-500">No trees found for any user. Please add tree data to users in Firestore.</td></tr>';
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
