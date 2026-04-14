import { db, checkLogin } from "./script.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Elements ---
const foresterFilter = document.getElementById("foresterFilter");
const applicantFilter = document.getElementById("applicantFilter");
const speciesFilter = document.getElementById("speciesFilter");
const appointmentTypeFilter = document.getElementById("appointmentTypeFilter");
const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const keywordSearch = document.getElementById("keywordSearch");
const reportTable = document
  .getElementById("reportTable")
  .querySelector("tbody");

// --- Headers ---
const applicationsHeader = document.getElementById("applicationsHeader");
const treesHeader = document.getElementById("treesHeader");
const loadingIndicator = document.getElementById("loadingIndicator");

// --- Firebase refs ---
const usersRef = collection(db, "users");
const applicationsRef = collection(db, "applications");
const appointmentsRef = collection(db, "appointments");

let applicationsData = [];
let appointmentsData = [];
let statusChartInstance = null;
let speciesChartInstance = null;
let submissionsTrendChartInstance = null;
let activityTrendChartInstance = null;
let topContributorsChartInstance = null;
let activeTab = "trees"; // track which tab is selected, default to trees

// Cache keys for sessionStorage
const CACHE_KEYS = {
  APPLICATIONS: 'treesure_reports_applications',
  APPOINTMENTS: 'treesure_reports_appointments',
  TIMESTAMP: 'treesure_reports_timestamp'
};

// --- Init ---
checkLogin();

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  populateFilters();
  renderTreesTable(appointmentsData);
  updateCharts(appointmentsData);
  setupTabs();

  keywordSearch?.addEventListener("input", applyFilters);
  document
    .getElementById("applyFilters")
    ?.addEventListener("click", applyFilters);
  
  // Refresh button handler
  document.getElementById("refreshData")?.addEventListener("click", async () => {
    await refreshData();
  });
});

// --- Load Data (with caching) ---
async function loadData(forceRefresh = false) {
  if (loadingIndicator) loadingIndicator.style.display = "block";
  
  if (!forceRefresh) {
    // Try to load from cache
    const cachedApps = sessionStorage.getItem(CACHE_KEYS.APPLICATIONS);
    const cachedAppts = sessionStorage.getItem(CACHE_KEYS.APPOINTMENTS);
    
    if (cachedApps && cachedAppts) {
      console.log("📦 Loading data from cache...");
      applicationsData = JSON.parse(cachedApps);
      appointmentsData = JSON.parse(cachedAppts);
      
      // Parse date strings back to Date objects
      applicationsData = applicationsData.map(app => ({
        ...app,
        date: app.date ? new Date(app.date) : null,
        createdAt: app.createdAt ? new Date(app.createdAt) : null,
        submittedAt: app.submittedAt ? new Date(app.submittedAt) : null,
        uploads: app.uploads.map(upload => ({
          ...upload,
          comments: upload.comments.map(comment => ({
            ...comment,
            createdAt: comment.createdAt ? new Date(comment.createdAt) : null
          }))
        }))
      }));
      
      appointmentsData = appointmentsData.map(appt => ({
        ...appt,
        date: appt.date ? new Date(appt.date) : null,
        completedAt: appt.completedAt ? new Date(appt.completedAt) : null
      }));
      
      if (loadingIndicator) loadingIndicator.style.display = "none";
      return;
    }
  }
  
  // Load from Firebase
  console.log("🔄 Fetching data from Firebase...");
  await loadApplications();
  await loadAppointments();
  
  // Save to cache
  sessionStorage.setItem(CACHE_KEYS.APPLICATIONS, JSON.stringify(applicationsData));
  sessionStorage.setItem(CACHE_KEYS.APPOINTMENTS, JSON.stringify(appointmentsData));
  sessionStorage.setItem(CACHE_KEYS.TIMESTAMP, new Date().toISOString());
  
  if (loadingIndicator) loadingIndicator.style.display = "none";
}

// --- Refresh Data ---
async function refreshData() {
  const refreshBtn = document.getElementById("refreshData");
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing...';
  }
  
  // Clear cache
  sessionStorage.removeItem(CACHE_KEYS.APPLICATIONS);
  sessionStorage.removeItem(CACHE_KEYS.APPOINTMENTS);
  sessionStorage.removeItem(CACHE_KEYS.TIMESTAMP);
  
  // Reload data
  await loadData(true);
  
  // Re-render current view
  populateFilters();
  if (activeTab === "trees") {
    renderTreesTable(appointmentsData);
    updateCharts(appointmentsData);
  } else {
    const filteredApps = applicationsData.filter(
      (a) => a.type.toLowerCase() === activeTab.toLowerCase()
    );
    renderApplicationsTable(filteredApps);
    updateCharts(filteredApps);
  }
  
  if (refreshBtn) {
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = '<i class="fa-solid fa-refresh"></i> Refresh Data';
  }
  
  alert("Data refreshed successfully!");
}

// --- Timestamp Parser ---
function parseTimestampString(ts) {
  if (!ts) return null;
  try {
    let cleaned = ts.replace(/\s+at\s+/i, " ");
    cleaned = cleaned.replace(/\s+UTC.*$/i, "");
    const parsed = Date.parse(cleaned);
    if (!isNaN(parsed)) return new Date(parsed);
    const alt = cleaned.replace(/,/g, "");
    const parsedAlt = Date.parse(alt);
    if (!isNaN(parsedAlt)) return new Date(parsedAlt);
  } catch (e) {}
  return null;
}

// --- Coordinate Formatter ---
function formatCoord(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return val ?? "N/A";
  return n.toFixed(5);
}

// --- Load all applications ---
async function loadApplications() {
  applicationsData = [];
  console.log("📥 Loading applications with submissions...");

  try {
    // Define all application types explicitly
    const applicationTypes = ['ctpo', 'chainsaw', 'cov', 'pltp', 'splt', 'ptc'];
    console.log(`📦 Processing ${applicationTypes.length} application types: ${applicationTypes.join(', ')}`);
    
    for (const appType of applicationTypes) {
      console.log(`📂 Processing ${appType} applications...`);
      
      try {
        const applicantsRef = collection(db, `applications/${appType}/applicants`);
        const applicantsSnap = await getDocs(applicantsRef);
        console.log(`  👥 Found ${applicantsSnap.docs.length} applicants for ${appType}`);

        if (applicantsSnap.empty) {
          console.log(`  ⚠️ No applicants found for ${appType}, skipping...`);
          continue;
        }

        for (const applicantDoc of applicantsSnap.docs) {
          const applicantData = applicantDoc.data();
          const applicantId = applicantDoc.id;
          
          // Extract applicant-level metadata
          const applicantName = applicantData.applicantName || "Unknown Applicant";
          const submissionsCount = applicantData.submissionsCount || 0;
          const lastUpdated = applicantData.lastUpdated?.toDate ? applicantData.lastUpdated.toDate() : null;
          
          console.log(`    📝 Applicant ${applicantId}: ${applicantName} (${submissionsCount} submission(s))`);
          
          // Fetch submissions subcollection for each applicant
          const submissionsRef = collection(db, `applications/${appType}/applicants/${applicantId}/submissions`);
          const submissionsSnap = await getDocs(submissionsRef);
          
          if (submissionsSnap.empty) {
            console.log(`      ⚠️ No submissions found for applicant ${applicantId}`);
            continue;
          }
          
          // Process each submission for this applicant
          for (const submissionDoc of submissionsSnap.docs) {
            const submissionData = submissionDoc.data();
            const submissionId = submissionDoc.id;
            
            console.log(`      🔖 Processing submission: ${submissionId}`);
            
            // Get submission date fields
            const submittedAtField = submissionData.submittedAt ?? submissionData.createdAt ?? null;
            const createdAtField = submissionData.createdAt ?? null;
            
            const dateObj =
              typeof submittedAtField === "string"
                ? parseTimestampString(submittedAtField)
                : submittedAtField?.toDate
                ? submittedAtField.toDate()
                : submittedAtField instanceof Date
                ? submittedAtField
                : null;
            
            const createdAtObj =
              typeof createdAtField === "string"
                ? parseTimestampString(createdAtField)
                : createdAtField?.toDate
                ? createdAtField.toDate()
                : createdAtField instanceof Date
                ? createdAtField
                : null;
            
            const submittedAtObj = submissionData.submittedAt?.toDate 
              ? submissionData.submittedAt.toDate() 
              : null;
            
            // Fetch uploads subcollection for each submission
            const uploadsRef = collection(db, `applications/${appType}/applicants/${applicantId}/submissions/${submissionId}/uploads`);
            const uploadsSnap = await getDocs(uploadsRef);
            
            const uploads = [];
            for (const uploadDoc of uploadsSnap.docs) {
              const uploadData = uploadDoc.data();
              
              // Fetch comments subcollection for each upload
              const commentsRef = collection(db, `applications/${appType}/applicants/${applicantId}/submissions/${submissionId}/uploads/${uploadDoc.id}/comments`);
              const commentsSnap = await getDocs(commentsRef);
              
              const comments = [];
              commentsSnap.forEach((commentDoc) => {
                const commentData = commentDoc.data();
                const commentDate = commentData.createdAt?.toDate 
                  ? commentData.createdAt.toDate() 
                  : commentData.createdAt instanceof Date
                  ? commentData.createdAt
                  : null;
                
                comments.push({
                  id: commentDoc.id,
                  from: commentData.from || "Unknown",
                  message: commentData.message || "",
                  createdAt: commentDate,
                });
              });
              
              uploads.push({
                id: uploadDoc.id,
                title: uploadData.title || uploadData.documentTitle || "Untitled",
                fileName: uploadData.fileName || "Unknown File",
                fileUrl: uploadData.fileUrl || uploadData.url || null,
                uploadedAt: uploadData.uploadedAt?.toDate ? uploadData.uploadedAt.toDate() : null,
                reuploadAllowed: uploadData.reuploadAllowed || false,
                comments: comments,
              });
            }
            
            console.log(`        📎 ${uploads.length} upload(s) found`);

            applicationsData.push({
              id: applicantId,
              submissionId: submissionId,
              applicant: applicantName,
              type: appType,
              permitType: (appType === "pltp" || appType === "splt") 
                ? (applicantData.permitType || applicantData.category || submissionData.permitType || "N/A") 
                : "N/A",
              status: submissionData.status || "submitted",
              date: dateObj,
              createdAt: createdAtObj,
              submittedAt: submittedAtObj,
              lastUpdated: lastUpdated,
              uploads: uploads,
              uploadCount: uploads.length,
              commentCount: uploads.reduce((sum, u) => sum + u.comments.length, 0),
              submissionsCount: submissionsCount,
            });
          }
        }
      } catch (typeError) {
        console.error(`❌ Error processing ${appType}:`, typeError.message);
        // Continue with other application types
      }
    }
    
    console.log(`✅ Loaded ${applicationsData.length} total submissions across all application types`);
  } catch (error) {
    console.error("❌ Error loading applications:", error);
    console.error("Error details:", error.message);
    throw error;
  }
}

// --- Load all appointments with tree inventory ---
async function loadAppointments() {
  appointmentsData = [];

  try {
    const appointmentsSnap = await getDocs(appointmentsRef);
    
    for (const appointmentDoc of appointmentsSnap.docs) {
      const appointmentData = appointmentDoc.data();
      const appointmentId = appointmentDoc.id;
      
      // Get applicant name from users collection
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
      
      // Get tree_inventory subcollection
      const treeInventoryRef = collection(db, `appointments/${appointmentId}/tree_inventory`);
      const treeInventorySnap = await getDocs(treeInventoryRef);
      
      // Process each tree in the inventory
      treeInventorySnap.forEach((treeDoc) => {
        const treeData = treeDoc.data();
        
        const tsField = treeData.timestamp ?? null;
        const dateObj =
          typeof tsField === "string"
            ? parseTimestampString(tsField)
            : tsField?.toDate
            ? tsField.toDate()
            : tsField instanceof Date
            ? tsField
            : null;
        
        appointmentsData.push({
          appointmentId: appointmentId,
          treeId: treeData.tree_id || treeData.tree_no || treeDoc.id,
          treeNo: treeData.tree_no || treeData.tree_id || treeDoc.id,
          appointmentType: appointmentData.appointmentType || "N/A",
          applicationType: appointmentData.applicationType || "N/A",
          applicantId: applicantId || "Unknown",
          applicantName: applicantName,
          species: treeData.specie || treeData.species || "Unknown",
          diameter: treeData.diameter || 0,
          height: treeData.height || 0,
          volume: treeData.volume || 0,
          location: appointmentData.location || "N/A",
          latitude: treeData.latitude || null,
          longitude: treeData.longitude || null,
          forester: treeData.forester_name || "Unknown Forester",
          foresterId: treeData.forester_id || null,
          status: appointmentData.status || "Pending",
          photoUrl: treeData.photo_url || null,
          qrUrl: treeData.qr_url || null,
          date: dateObj,
          remarks: appointmentData.remarks || "",
          adminId: appointmentData.adminId || "N/A",
          completedAt: appointmentData.completedAt?.toDate ? appointmentData.completedAt.toDate() : null,
        });
      });
    }
    
    console.log("📋 Loaded appointments data:", appointmentsData.length, "trees");
  } catch (error) {
    console.error("❌ Error loading appointments:", error);
  }
}

// --- Tabs Logic ---
function setupTabs() {
  const tabs = document.querySelectorAll(".tab");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeTab = tab.dataset.tab;

      if (loadingIndicator) loadingIndicator.style.display = "block";
      reportTable.innerHTML = "";

      if (activeTab === "trees") {
        applicationsHeader.style.display = "none";
        treesHeader.style.display = "";
        renderTreesTable(appointmentsData);
        updateCharts(appointmentsData);
      } else {
        applicationsHeader.style.display = "";
        treesHeader.style.display = "none";
        const filteredApps = applicationsData.filter(
          (a) => a.type.toLowerCase() === activeTab.toLowerCase()
        );
        renderApplicationsTable(filteredApps);
        updateCharts(filteredApps);
      }

      if (loadingIndicator) loadingIndicator.style.display = "none";
    });
  });
}

// --- Apply Filters ---
function applyFilters() {
  const fForester = foresterFilter?.value ?? "all";
  const fApplicant = applicantFilter?.value ?? "all";
  const fSpecies = speciesFilter?.value ?? "all";
  const fAppointmentType = appointmentTypeFilter?.value ?? "all";
  const startDate = startDateInput?.value ?? "";
  const endDate = endDateInput?.value ?? "";
  const keyword = (keywordSearch?.value ?? "").toLowerCase().trim();

  let dataToFilter;
  if (activeTab === "trees") {
    dataToFilter = appointmentsData;
  } else {
    dataToFilter = applicationsData.filter(
      (a) => a.type.toLowerCase() === activeTab.toLowerCase()
    );
  }

  let filtered = dataToFilter.filter((d) => {
    const matchForester =
      activeTab === "trees"
        ? fForester === "all" || d.forester === fForester
        : true;
    const matchApplicant = fApplicant === "all" || d.applicant === fApplicant || d.applicantName === fApplicant || d.applicantId === fApplicant;
    const matchSpecies =
      activeTab === "trees" ? fSpecies === "all" || d.species === fSpecies : true;
    const matchAppointmentType =
      activeTab === "trees" ? fAppointmentType === "all" || d.applicationType === fAppointmentType : true;

    const matchDate =
      (!startDate || (d.date && d.date >= new Date(startDate))) &&
      (!endDate || (d.date && d.date <= new Date(endDate + "T23:59:59")));

    const matchKeyword =
      !keyword || Object.values(d).join(" ").toLowerCase().includes(keyword);

    return (
      matchForester &&
      matchApplicant &&
      matchSpecies &&
      matchAppointmentType &&
      matchDate &&
      matchKeyword
    );
  });

  if (activeTab === "trees") {
    renderTreesTable(filtered);
  } else {
    renderApplicationsTable(filtered);
  }
  updateCharts(filtered);
}

// --- Render Applications Table ---
function renderApplicationsTable(data) {
  reportTable.innerHTML = "";
  if (!data || data.length === 0) {
    reportTable.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#888;">No applications found for this type</td></tr>`;
    return;
  }

  data.forEach((d, index) => {
    const dateStr = d.date ? d.date.toLocaleDateString() : "N/A";
    const uploadCount = d.uploadCount || 0;
    const statusIcon = d.status === "submitted" ? "✓" : "📝";
    const statusColor = d.status === "submitted" ? "color: green; font-weight: bold;" : "color: orange; font-weight: bold;";
    
    const row = `
      <tr>
        <td>${dateStr}</td>
        <td>${escapeHtml(d.applicant)}</td>
        <td><code>${escapeHtml(d.submissionId || "N/A")}</code></td>
        <td>${escapeHtml(d.type.toUpperCase())}</td>
        <td style="${statusColor}">${statusIcon} ${escapeHtml(d.status)}</td>
        <td>${uploadCount} file(s)</td>
        <td><button class="view-details-btn" data-index="${index}">📄 View Details</button></td>
      </tr>`;
    reportTable.insertAdjacentHTML("beforeend", row);
  });

  // Attach click handlers to view details buttons
  document.querySelectorAll(".view-details-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(e.target.dataset.index);
      showApplicationDetails(data[index]);
    });
  });
}

// --- Render Trees Table ---
function renderTreesTable(data) {
  reportTable.innerHTML = "";
  if (!data || data.length === 0) {
    reportTable.innerHTML = `<tr><td colspan="14">No trees found</td></tr>`;
    return;
  }

  data.forEach((d) => {
    const dateStr = d.date ? d.date.toLocaleDateString() : "N/A";
    const lat = d.latitude != null ? formatCoord(d.latitude) : "N/A";
    const lng = d.longitude != null ? formatCoord(d.longitude) : "N/A";
    
    // QR Code display
    const qrCodeHtml = d.qrUrl 
      ? `<img src="${escapeHtml(d.qrUrl)}" alt="QR Code" style="width: 50px; height: 50px; cursor: pointer;" onclick="window.open('${escapeHtml(d.qrUrl)}', '_blank')" />`
      : "N/A";
    
    const row = `
      <tr>
        <td>${escapeHtml(d.treeNo)}</td>
        <td>${escapeHtml(d.applicationType)}</td>
        <td>${escapeHtml(d.applicantName || d.applicantId)}</td>
        <td>${escapeHtml(d.species)}</td>
        <td>${d.diameter}</td>
        <td>${d.height}</td>
        <td>${d.volume.toFixed(2)}</td>
        <td>${escapeHtml(d.location)}</td>
        <td>${lat}</td>
        <td>${lng}</td>
        <td>${escapeHtml(d.forester)}</td>
        <td>${escapeHtml(d.status)}</td>
        <td>${dateStr}</td>
        <td>${qrCodeHtml}</td>
      </tr>`;
    reportTable.insertAdjacentHTML("beforeend", row);
  });
}

// --- Render All Trees Table ---
// --- Populate Filters ---
function populateFilters() {
  const foresters = new Set();
  const applicants = new Set();
  const species = new Set();
  const appointmentTypes = new Set();

  // Add data from appointments
  appointmentsData.forEach((t) => {
    if (t.forester && t.forester !== "Unknown Forester") foresters.add(t.forester);
    if (t.applicantName && t.applicantName !== "Unknown") applicants.add(t.applicantName);
    if (t.species && t.species !== "Unknown") species.add(t.species);
    if (t.applicationType && t.applicationType !== "N/A") appointmentTypes.add(t.applicationType);
  });
  
  // Add applicants from applications data
  applicationsData.forEach((app) => {
    if (app.applicant && app.applicant !== "Unknown Applicant") applicants.add(app.applicant);
  });

  populateSelect(foresterFilter, [...foresters], "All Foresters");
  populateSelect(applicantFilter, [...applicants], "All Applicants");
  populateSelect(speciesFilter, [...species], "All Species");
  populateSelect(appointmentTypeFilter, [...appointmentTypes], "All Application Types");


  [
    foresterFilter,
    applicantFilter,
    speciesFilter,
    appointmentTypeFilter,
    startDateInput,
    endDateInput,
  ].forEach((el) => el?.addEventListener("change", applyFilters));
}

function populateSelect(select, items, label = null) {
  if (!select) return;
  select.innerHTML = `<option value="all">${
    label ?? "All " + select.id.replace("Filter", "")
  }</option>`;
  items.sort().forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    select.appendChild(opt);
  });
}

// --- Escape HTML ---
function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// --- Charts ---
function updateCharts(data) {
  drawStatusChart(data);
  drawSpeciesChart(data);
  drawSubmissionsTrendChart(data);
  drawActivityTrendChart(data);
  drawTopContributorsChart(data);
}

function normalizeDateKey(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return value.toISOString().split("T")[0];
}

function formatDateLabel(dateKey) {
  const d = new Date(`${dateKey}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

function getDateBuckets(data) {
  const buckets = {};
  data.forEach((item) => {
    const key = normalizeDateKey(item.date);
    if (!key) return;
    buckets[key] = (buckets[key] || 0) + 1;
  });
  return buckets;
}

function drawStatusChart(data) {
  const ctxEl = document.getElementById("statusChart");
  if (!ctxEl) return;
  const ctx = ctxEl.getContext("2d");
  if (statusChartInstance) statusChartInstance.destroy();

  const statusCount = data.reduce((acc, d) => {
    const s = d.status || "pending";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  // Generate colors dynamically based on status
  const statusColors = {
    'pending': '#f4b400',
    'approved': '#0f9d58',
    'rejected': '#db4437',
    'completed': '#4caf50',
    'submitted': '#2196f3',
  };
  
  const colors = Object.keys(statusCount).map(status => 
    statusColors[status.toLowerCase()] || '#9e9e9e'
  );

  statusChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(statusCount).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
      datasets: [
        {
          data: Object.values(statusCount),
          backgroundColor: colors,
        },
      ],
    },
    options: { 
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { position: "bottom" },
        title: {
          display: true,
          text: 'Status Distribution',
          font: { size: 14, weight: 'bold' }
        }
      } 
    },
  });
}

function drawSpeciesChart(data) {
  const ctxEl = document.getElementById("speciesChart");
  if (!ctxEl) return;
  const ctx = ctxEl.getContext("2d");
  if (speciesChartInstance) speciesChartInstance.destroy();

  // Determine what to count based on active tab
  let counts = {};
  let chartTitle = '';
  
  if (activeTab === "trees") {
    // For Trees tab: show species distribution
    counts = data.reduce((acc, d) => {
      const s = d.species || "Unknown";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    chartTitle = 'Species Distribution';
  } else {
    // For Application tabs: show application type distribution
    counts = data.reduce((acc, d) => {
      const type = d.type ? d.type.toUpperCase() : "Unknown";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    chartTitle = 'Application Type Distribution';
  }

  speciesChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(counts),
      datasets: [
        { 
          data: Object.values(counts), 
          backgroundColor: "#4caf50",
          label: activeTab === "trees" ? "Trees" : "Applications"
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: false },
        title: {
          display: true,
          text: chartTitle,
          font: { size: 14, weight: 'bold' }
        }
      },
      scales: {
        x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 } },
        y: { 
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      },
    },
  });
}

function drawSubmissionsTrendChart(data) {
  const ctxEl = document.getElementById("submissionsTrendChart");
  if (!ctxEl) return;
  const ctx = ctxEl.getContext("2d");
  if (submissionsTrendChartInstance) submissionsTrendChartInstance.destroy();

  const dateBuckets = getDateBuckets(data);
  const sortedKeys = Object.keys(dateBuckets).sort();
  const labels = sortedKeys.length ? sortedKeys.map(formatDateLabel) : ["No data"];
  const values = sortedKeys.length ? sortedKeys.map((k) => dateBuckets[k]) : [0];

  submissionsTrendChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Records",
          data: values,
          borderColor: "#467f3c",
          backgroundColor: "rgba(70, 127, 60, 0.15)",
          pointBackgroundColor: "#467f3c",
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.35,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Record Volume Trend",
          font: { size: 14, weight: "bold" },
        },
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
    },
  });
}

function drawActivityTrendChart(data) {
  const ctxEl = document.getElementById("activityTrendChart");
  if (!ctxEl) return;
  const ctx = ctxEl.getContext("2d");
  if (activityTrendChartInstance) activityTrendChartInstance.destroy();

  const aggregates = {};
  data.forEach((item) => {
    const dateKey = normalizeDateKey(item.date);
    if (!dateKey) return;
    if (!aggregates[dateKey]) aggregates[dateKey] = { sum: 0, count: 0 };

    const metric = activeTab === "trees"
      ? Number(item.volume || 0)
      : Number(item.uploadCount || 0);

    aggregates[dateKey].sum += Number.isFinite(metric) ? metric : 0;
    aggregates[dateKey].count += 1;
  });

  const sortedKeys = Object.keys(aggregates).sort();
  const labels = sortedKeys.length ? sortedKeys.map(formatDateLabel) : ["No data"];
  const values = sortedKeys.length
    ? sortedKeys.map((k) => {
        const { sum, count } = aggregates[k];
        if (count === 0) return 0;
        return activeTab === "trees" ? Number((sum / count).toFixed(2)) : sum;
      })
    : [0];

  const datasetLabel = activeTab === "trees" ? "Avg Volume" : "Uploads";
  const titleText = activeTab === "trees"
    ? "Average Tree Volume Trend"
    : "Upload Activity Trend";

  activityTrendChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: datasetLabel,
          data: values,
          borderColor: "#1d4ed8",
          backgroundColor: "rgba(29, 78, 216, 0.12)",
          pointBackgroundColor: "#1d4ed8",
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.35,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: titleText,
          font: { size: 14, weight: "bold" },
        },
      },
      scales: {
        y: { beginAtZero: true },
      },
    },
  });
}

function drawTopContributorsChart(data) {
  const ctxEl = document.getElementById("topContributorsChart");
  if (!ctxEl) return;
  const ctx = ctxEl.getContext("2d");
  if (topContributorsChartInstance) topContributorsChartInstance.destroy();

  const counts = {};
  data.forEach((item) => {
    const key = activeTab === "trees"
      ? (item.forester || "Unknown Forester")
      : (item.applicant || "Unknown Applicant");
    counts[key] = (counts[key] || 0) + 1;
  });

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const labels = sorted.length ? sorted.map(([k]) => k) : ["No data"];
  const values = sorted.length ? sorted.map(([, v]) => v) : [0];
  const titleText = activeTab === "trees" ? "Top Foresters by Tree Records" : "Top Applicants by Submissions";

  topContributorsChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: "#467f3c",
          borderRadius: 8,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: titleText,
          font: { size: 14, weight: "bold" },
        },
      },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
    },
  });
}

/***********************
 * 📤 EXPORT & SYNC FUNCTIONS
 ***********************/

// --- Get currently active tab ---
function getCurrentTab() {
  const activeTab = document.querySelector(".tab.active");
  return activeTab ? activeTab.dataset.tab : "trees";
}

// --- Get visible headers and rows dynamically ---
function getVisibleColumnsAndData() {
  const currentTab = getCurrentTab();
  const applicationsHeader = document.getElementById("applicationsHeader");
  const treesHeader = document.getElementById("treesHeader");
  const tableBody = document.querySelector("#reportTable tbody");

  // 🧠 Detect which header to use based on tab
  let headerRow;
  if (currentTab === "trees") {
    headerRow = treesHeader;
  } else {
    headerRow = applicationsHeader;
  }

  // 🧩 Read visible column headers directly from HTML
  const allHeaders = Array.from(headerRow.querySelectorAll("th")).map((th) =>
    th.textContent.trim()
  );
  
  // 🚫 Find the indices of columns to exclude (Actions and QR Code)
  const excludeColumns = [];
  allHeaders.forEach((header, index) => {
    const lowerHeader = header.toLowerCase();
    if (lowerHeader === "actions" || lowerHeader === "qr code") {
      excludeColumns.push(index);
    }
  });
  
  // Filter out excluded columns from headers
  const headers = allHeaders.filter((h, index) => !excludeColumns.includes(index));

  // 🧩 Get all visible row data from the table body, excluding specified columns
  const rows = Array.from(tableBody.querySelectorAll("tr")).map((tr) =>
    Array.from(tr.querySelectorAll("td"))
      .map((td) => td.textContent.trim())
      .filter((_, index) => !excludeColumns.includes(index))
  );

  return { headers, rows, currentTab };
}

// --- File name utility ---
function getFileName(tab, type) {
  const date = new Date().toISOString().split("T")[0];
  return `treesure_${tab}_report_${date}.${type}`;
}

/***********************
 * 📄 EXPORT TO PDF
 ***********************/
document.getElementById("exportPDF")?.addEventListener("click", () => {
  const { headers, rows, currentTab } = getVisibleColumnsAndData();
  if (!rows.length) return alert("No data available to export!");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("l", "pt", "a4");

  doc.text(`TreeSure Report - ${currentTab.toUpperCase()}`, 40, 40);
  doc.autoTable({
    head: [headers],
    body: rows,
    startY: 60,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [46, 125, 50] },
  });

  doc.save(getFileName(currentTab, "pdf"));
});

/***********************
 * 📊 EXPORT TO EXCEL
 ***********************/
document.getElementById("exportExcel")?.addEventListener("click", () => {
  const { headers, rows, currentTab } = getVisibleColumnsAndData();
  if (!rows.length) return alert("No data available to export!");

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Reports");
  XLSX.writeFile(wb, getFileName(currentTab, "xlsx"));
});

/***********************
 * 📈 EXPORT TO CSV
 ***********************/
document.getElementById("exportCSV")?.addEventListener("click", () => {
  const { headers, rows, currentTab } = getVisibleColumnsAndData();
  if (!rows.length) return alert("No data available to export!");

  const csvContent = [
    headers.join(","),
    ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = getFileName(currentTab, "csv");
  link.click();
});

/***********************
 * 🖨️ PRINT REPORT
 ***********************/
document.getElementById("printReport")?.addEventListener("click", () => {
  const { headers, rows, currentTab } = getVisibleColumnsAndData();
  if (!rows.length) return alert("No data available to print!");

  const html = `
    <html>
    <head>
      <title>TreeSure Report - ${currentTab}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h2 { color: #2e7d32; }
        table { border-collapse: collapse; width: 100%; margin-top: 15px; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        th { background-color: #2e7d32; color: #fff; }
        tr:nth-child(even) { background-color: #f9f9f9; }
      </style>
    </head>
    <body>
      <h2>TreeSure Report - ${currentTab.toUpperCase()}</h2>
      <table>
        <thead>
          <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) =>
                `<tr>${r.map((v) => `<td>${v || ""}</td>`).join("")}</tr>`
            )
            .join("")}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const printWin = window.open("", "_blank");
  printWin.document.write(html);
  printWin.document.close();
  printWin.print();
});

/***********************
 * 📋 APPLICATION DETAILS MODAL
 ***********************/
function showApplicationDetails(application) {
  const modal = document.getElementById("applicationDetailsModal");
  const content = document.getElementById("applicationDetailsContent");
  
  if (!modal || !content) return;

  // Build the details HTML
  let uploadsHtml = "";
  if (application.uploads && application.uploads.length > 0) {
    uploadsHtml = application.uploads.map((upload, index) => {
      const commentsHtml = upload.comments && upload.comments.length > 0
        ? upload.comments.map((comment) => {
            const commentDate = comment.createdAt 
              ? comment.createdAt.toLocaleString() 
              : "N/A";
            return `
              <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p><span class="font-bold text-forest-900">From:</span> ${escapeHtml(comment.from)}</p>
                <p class="mt-1"><span class="font-bold text-forest-900">Message:</span> ${escapeHtml(comment.message)}</p>
                <p class="mt-1"><span class="font-bold text-forest-900">Date:</span> ${commentDate}</p>
              </div>
            `;
          }).join("")
        : "<p class='text-sm font-medium text-slate-500'>No comments yet.</p>";
      
      const reuploadBadge = upload.reuploadAllowed 
        ? '<span class="inline-flex items-center rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white">Reupload Required</span>'
        : '<span class="inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">Approved</span>';
      
      const uploadedAtStr = upload.uploadedAt ? upload.uploadedAt.toLocaleString() : "N/A";
      
      const fileLink = upload.fileUrl 
        ? `<a href="${escapeHtml(upload.fileUrl)}" target="_blank" class="inline-flex items-center text-sm font-bold text-forest-700 hover:text-forest-800">View File</a>`
        : "No file URL";

      return `
        <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="mb-3 flex flex-wrap items-start justify-between gap-2">
            <h4 class="text-base font-extrabold text-forest-900">${index + 1}. ${escapeHtml(upload.title)}</h4>
            ${reuploadBadge}
          </div>
          <div class="space-y-1 text-sm text-slate-700">
            <p><span class="font-bold text-forest-900">File Name:</span> ${escapeHtml(upload.fileName)}</p>
            <p><span class="font-bold text-forest-900">Document ID:</span> <code class="break-all rounded bg-slate-100 px-1.5 py-0.5 text-xs">${escapeHtml(upload.id)}</code></p>
            <p><span class="font-bold text-forest-900">Uploaded At:</span> ${uploadedAtStr}</p>
            <p><span class="font-bold text-forest-900">File:</span> ${fileLink}</p>
          </div>
          <div class="mt-4 border-t border-slate-200 pt-3">
            <h5 class="mb-2 text-sm font-extrabold text-slate-700">Comments (${upload.comments.length})</h5>
            <div class="space-y-2">${commentsHtml}</div>
          </div>
        </article>
      `;
    }).join("");
  } else {
    uploadsHtml = "<p class='rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm font-medium text-slate-500'>No uploads found for this submission.</p>";
  }

  const statusBadge = application.status === "submitted" 
    ? '<span class="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-sm font-bold text-white">Submitted</span>'
    : '<span class="inline-flex items-center rounded-full bg-amber-500 px-3 py-1 text-sm font-bold text-white">Draft</span>';
  
  const createdAtStr = application.createdAt ? application.createdAt.toLocaleString() : "N/A";
  const submittedAtStr = application.submittedAt ? application.submittedAt.toLocaleString() : "Not yet submitted";
  const dateSubmitted = application.date ? application.date.toLocaleString() : "N/A";
  const lastUpdatedStr = application.lastUpdated ? application.lastUpdated.toLocaleString() : "N/A";
  
  content.innerHTML = `
    <div class="space-y-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-2xl font-black text-forest-900">${escapeHtml(application.applicant)}</h3>
          ${application.submissionsCount > 1 ? `<p class="mt-1 text-sm font-medium text-slate-500">Applicant has ${application.submissionsCount} total submissions.</p>` : ''}
        </div>
        ${statusBadge}
      </div>

      <section class="rounded-2xl border border-forest-100 bg-gradient-to-br from-forest-50 to-white p-5">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="rounded-xl bg-white p-3 ring-1 ring-slate-100"><p class="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Applicant ID</p><p class="mt-1 break-all text-sm font-semibold text-slate-800">${escapeHtml(application.id)}</p></div>
          <div class="rounded-xl bg-white p-3 ring-1 ring-slate-100"><p class="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Submission ID</p><p class="mt-1 break-all text-sm font-semibold text-slate-800">${escapeHtml(application.submissionId || "N/A")}</p></div>
          <div class="rounded-xl bg-white p-3 ring-1 ring-slate-100"><p class="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Application Type</p><p class="mt-1 text-sm font-semibold text-slate-800">${escapeHtml(application.type.toUpperCase())}</p></div>
          ${application.permitType !== "N/A" ? `<div class="rounded-xl bg-white p-3 ring-1 ring-slate-100"><p class="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Permit Type</p><p class="mt-1 text-sm font-semibold text-slate-800">${escapeHtml(application.permitType)}</p></div>` : ''}
          <div class="rounded-xl bg-white p-3 ring-1 ring-slate-100"><p class="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Created</p><p class="mt-1 text-sm font-semibold text-slate-800">${createdAtStr}</p></div>
          <div class="rounded-xl bg-white p-3 ring-1 ring-slate-100"><p class="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Submitted</p><p class="mt-1 text-sm font-semibold text-slate-800">${submittedAtStr}</p></div>
          <div class="rounded-xl bg-white p-3 ring-1 ring-slate-100"><p class="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Last Updated</p><p class="mt-1 break-all text-sm font-semibold text-slate-800">${lastUpdatedStr}</p></div>
          <div class="rounded-xl bg-white p-3 ring-1 ring-slate-100"><p class="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Date</p><p class="mt-1 text-sm font-semibold text-slate-800">${dateSubmitted}</p></div>
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <div class="rounded-xl border border-forest-200 bg-white px-4 py-3"><p class="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Total Uploads</p><p class="mt-1 text-2xl font-black text-forest-700">${application.uploadCount || 0}</p></div>
          <div class="rounded-xl border border-forest-200 bg-white px-4 py-3"><p class="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Total Comments</p><p class="mt-1 text-2xl font-black text-forest-700">${application.commentCount || 0}</p></div>
        </div>
      </section>

      <section class="space-y-3">
        <h4 class="text-lg font-extrabold text-forest-900">Uploaded Documents & Comments</h4>
        <div class="space-y-3">${uploadsHtml}</div>
      </section>
    </div>
  `;

  modal.style.display = "flex";
}

// Close modal functionality
document.getElementById("closeDetailsModal")?.addEventListener("click", () => {
  document.getElementById("applicationDetailsModal").style.display = "none";
});

window.addEventListener("click", (event) => {
  const modal = document.getElementById("applicationDetailsModal");
  if (event.target === modal) {
    modal.style.display = "none";
  }
});