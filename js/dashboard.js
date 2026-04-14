import { db, checkLogin } from "./script.js";
import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const totalTaggedEl = document.getElementById("totalTaggedTrees");
const speciesCountEl = document.getElementById("speciesCount");
const avgTreesEl = document.getElementById("avgTreesPerForester");
const totalForester = document.getElementById("totalForester");
const totalApplicants = document.getElementById("totalApplicants");
const totalApplicationsEl = document.getElementById("totalApplications");
const pendingApplicationsEl = document.getElementById("pendingApplications");
const approvedApplicationsEl = document.getElementById("approvedApplications");
const applicationsThisMonthEl = document.getElementById("applicationsThisMonth");
const treesTaggedThisMonthEl = document.getElementById("treesTaggedThisMonth");
const activeAppointmentsEl = document.getElementById("activeAppointments");
const completedAppointmentsEl = document.getElementById("completedAppointments");
const avgTreesPerForesterEl = document.getElementById("avgTreesPerForester");

// Application type counts
const ctpoCountEl = document.getElementById("ctpoCount");
const pltpCountEl = document.getElementById("pltpCount");
const spltCountEl = document.getElementById("spltCount");
const ptcCountEl = document.getElementById("ptcCount");
const chainsawCountEl = document.getElementById("chainsawCount");

// Monthly comparison
const applicationsLastMonthEl = document.getElementById("applicationsLastMonth");
const applicationGrowthEl = document.getElementById("applicationGrowth");

// Top performers
const topForesterEl = document.getElementById("topForester");
const topForesterCountEl = document.getElementById("topForesterCount");
const topSpeciesEl = document.getElementById("topSpecies");
const topSpeciesCountEl = document.getElementById("topSpeciesCount");
const topLocationEl = document.getElementById("topLocation");
const topLocationCountEl = document.getElementById("topLocationCount");

const speciesFilter = document.getElementById("speciesFilter");
const foresterFilter = document.getElementById("foresterFilter");
const applicantFilter = document.getElementById("applicantFilter");

checkLogin();

const usersRef = collection(db, "users");
const applicationsRef = collection(db, "applications");
const appointmentsRef = collection(db, "appointments");
const inventoryCache = {};
let allTrees = [];
let allApplications = [];
let allAppointments = [];
let map, markersLayer;
let statusChartInstance, appointmentTypeChartInstance;
let speciesChartInstance, foresterChartInstance, trendChartInstance;

// Cache keys for sessionStorage
const CACHE_KEYS = {
  TREES: 'treesure_dashboard_trees',
  APPLICATIONS: 'treesure_dashboard_applications',
  APPOINTMENTS: 'treesure_dashboard_appointments',
  USER_DIRECTORY: 'treesure_dashboard_users',
  TIMESTAMP: 'treesure_dashboard_timestamp'
};

// 🔹 Approximate coordinates for municipalities in Cagayan
const municipalityCoords = {
  aparri: [18.36, 121.64],
  camalanuigan: [18.27, 121.67],
  buguey: [18.29, 121.83],
  "sta teresita": [18.25, 121.88],
  gonzaga: [18.27, 122.01],
  "sta ana": [18.46, 122.13],
  lallo: [18.2, 121.67],
  gattaran: [18.1, 121.63],
  lasam: [18.06, 121.6],
  allacapan: [18.23, 121.54],
};

const APPLICATION_LABELS = {
  ctpo: "CTPO",
  pltp: "PLTP",
  splt: "SPLT",
  spltp: "SPLT",
  ptc: "Permit to Cut",
  permitcut: "Permit to Cut",
  "permit-to-cut": "Permit to Cut",
  permitcutting: "Permit to Cut",
  permitcutpermit: "Permit to Cut",
  chainsaw: "Chainsaw",
  chainsawregistration: "Chainsaw",
  "chainsaw registration": "Chainsaw",
  chainsawpermit: "Chainsaw",
  "chainsaw permit": "Chainsaw",
  chainsawpermits: "Chainsaw",
  ctt: "CTT",
};

const DASHBOARD_COUNTER_KEYS = [
  "CTPO",
  "PLTP",
  "SPLT",
  "Permit to Cut",
  "Chainsaw",
];

let userDirectory = new Map();

function normalizeApplicationType(rawType) {
  if (!rawType) return "OTHER";
  const key = rawType.toString().trim().toLowerCase();
  return APPLICATION_LABELS[key] || rawType.toString().toUpperCase();
}

function toTitleCase(value) {
  if (!value) return "";
  return value
    .toString()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseTimestamp(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") {
    try {
      return value.toDate();
    } catch (err) {
      console.warn("⚠️ Failed to parse Firestore timestamp", err);
    }
  }
  if (typeof value === "number") {
    return new Date(value);
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    typeof value.seconds === "number"
  ) {
    return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6));
  }
  return null;
}

function formatStatus(value) {
  if (!value) return "Pending";
  const normalized = value.toString().trim().toLowerCase();
  if (!normalized) return "Pending";
  if (normalized.includes("approve")) return "Approved";
  if (normalized.includes("deny") || normalized.includes("reject")) return "Denied";
  if (normalized.includes("review")) return "Under Review";
  if (normalized.includes("complete")) return "Completed";
  if (normalized.includes("active")) return "Active";
  if (normalized.includes("schedule")) return "Scheduled";
  if (normalized.includes("pending")) return "Pending";
  return toTitleCase(value);
}

function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function inferMunicipality(treeData = {}, ownerData = {}) {
  const direct = treeData.municipality || treeData.cityMunicipality || treeData.municipalityName;
  if (direct) return toTitleCase(direct);

  const searchSpace = [
    treeData.location,
    treeData.address,
    treeData.barangay,
    ownerData.address,
    ownerData.municipality,
    ownerData.city,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (searchSpace) {
    for (const key of Object.keys(municipalityCoords)) {
      if (searchSpace.includes(key)) {
        return toTitleCase(key);
      }
    }
  }
  return "Unspecified";
}

function normalizeTreeRecord(treeData, ownerData = {}, ownerId) {
  if (!treeData) return null;
  const municipality = inferMunicipality(treeData, ownerData);
  const latitude = toNumber(treeData.latitude ?? treeData.lat ?? treeData.location?.lat);
  const longitude = toNumber(treeData.longitude ?? treeData.lng ?? treeData.location?.lng);
  const dateTagged =
    parseTimestamp(treeData.date_tagged) ||
    parseTimestamp(treeData.dateTagged) ||
    parseTimestamp(treeData.taggedAt) ||
    parseTimestamp(treeData.timestamp) ||
    parseTimestamp(treeData.createdAt);

  const species = treeData.specie || treeData.species || treeData.treeSpecies || "Unknown";
  const foresterName =
    treeData.forester_name ||
    treeData.foresterName ||
    treeData.inventoriedBy ||
    ownerData.name ||
    "Unknown Forester";

  return {
    id: treeData.id,
    tree_no: treeData.tree_no || treeData.treeId || treeData.tree_id || treeData.id,
    specie: species,
    species,
    municipality,
    barangay:
      treeData.barangay ||
      treeData.barangayName ||
      treeData.locationBarangay ||
      ownerData.barangay ||
      "",
    latitude,
    longitude,
    diameter: treeData.diameter || treeData.dbh || null,
    height: treeData.height || treeData.treeHeight || null,
    volume: treeData.volume || null,
    foresterName,
    ownerId,
    ownerName: ownerData.name || treeData.applicantName || "Unknown Owner",
    date_tagged: dateTagged,
    raw: treeData,
  };
}

function normalizeTreeFromAppointment(treeData, treeId, appointmentId, appointmentData = {}) {
  if (!treeData) return null;
  const foresterId =
    treeData.forester_id ||
    treeData.foresterId ||
    (Array.isArray(appointmentData.foresterIds)
      ? appointmentData.foresterIds[0]
      : null);
  const foresterInfo = foresterId ? userDirectory.get(foresterId) : null;
  const applicantInfo = appointmentData.applicantId
    ? userDirectory.get(appointmentData.applicantId)
    : null;

  const municipality = inferMunicipality(treeData, applicantInfo || {});
  const latitude = toNumber(treeData.latitude ?? treeData.lat ?? treeData.location?.lat);
  const longitude = toNumber(treeData.longitude ?? treeData.lng ?? treeData.location?.lng);
  const dateTagged =
    parseTimestamp(treeData.timestamp) ||
    parseTimestamp(treeData.date_tagged) ||
    parseTimestamp(treeData.dateTagged) ||
    parseTimestamp(treeData.createdAt) ||
    parseTimestamp(appointmentData.createdAt);

  const species = treeData.specie || treeData.species || treeData.treeSpecies || "Unknown";
  const foresterName =
    treeData.forester_name ||
    treeData.foresterName ||
    foresterInfo?.name ||
    "Unknown Forester";

  return {
    id: treeId,
    appointmentId,
    tree_no: treeData.tree_no || treeData.tree_id || treeId,
    specie: species,
    species,
    municipality,
    barangay: treeData.barangay || appointmentData.barangay || "",
    latitude,
    longitude,
    diameter: treeData.diameter || treeData.dbh || null,
    height: treeData.height || null,
    volume: treeData.volume || null,
    foresterName,
    ownerId: appointmentData.applicantId || null,
    ownerName: applicantInfo?.name || treeData.applicantName || "Unknown Owner",
    date_tagged: dateTagged,
    raw: treeData,
  };
}

// ---------- Initialize Map ----------
function initMap() {
  map = L.map("treeMap", { keyboard: false }).setView([18.3, 121.7], 9);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
  markersLayer = L.featureGroup().addTo(map);
}

// ---------- Fetch User Trees ----------
async function fetchUserTrees(userId) {
  if (inventoryCache[userId]) return inventoryCache[userId];
  const inventoryRef = collection(db, `users/${userId}/tree_inventory`);
  const snapshot = await getDocs(inventoryRef);
  const trees = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  inventoryCache[userId] = trees;
  return trees;
}

// ---------- Load Applications Data ----------
async function loadApplicationsData() {
  allApplications = [];
  console.log("📥 Loading applications with submissions...");

  const counts = {
    CTPO: 0,
    PLTP: 0,
    SPLT: 0,
    "Permit to Cut": 0,
    Chainsaw: 0,
  };

  try {
    // Define all application types explicitly (matching reports.js)
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
          const userId = applicantDoc.id;
          const applicantData = applicantDoc.data();
          
          console.log(`    📝 Applicant ${userId}`);
          
          // Load submissions from the new multi-submission structure
          const submissionsRef = collection(
            db,
            `applications/${appType}/applicants/${userId}/submissions`
          );
          const submissionsSnap = await getDocs(submissionsRef);

          if (submissionsSnap.empty) {
            console.log(`      ⚠️ No submissions found for applicant ${userId}`);
            continue;
          }

          for (const submissionDoc of submissionsSnap.docs) {
            const data = submissionDoc.data();
            console.log(`      🔖 Processing submission: ${submissionDoc.id}`);
            
            const createdAt =
              parseTimestamp(data.createdAt) ||
              parseTimestamp(data.submittedAt) ||
              parseTimestamp(data.submitted_at) ||
              parseTimestamp(data.uploadedAt) ||
              parseTimestamp(data.timestamp) ||
              parseTimestamp(data.dateSubmitted) ||
              parseTimestamp(data.appliedAt) ||
              parseTimestamp(data.created_date) ||
              null;

            // Get applicant name from user directory or submission data
            const userInfo = userDirectory.get(userId);
            const applicantName =
              userInfo?.name ||
              applicantData.applicantName ||
              data.applicantName ||
              data.name ||
              data.fullName ||
              data.ownerName ||
              "Unknown Applicant";

            const status = formatStatus(
              data.status ||
                data.applicationStatus ||
                data.reviewStatus ||
                data.progressStatus ||
                data.currentStatus ||
                data.state ||
                "Pending"
            );

            const normalizedType = normalizeApplicationType(appType);

            allApplications.push({
              id: submissionDoc.id,
              submissionId: submissionDoc.id,
              userId,
              type: normalizedType,
              rawType: appType,
              status,
              createdAt: createdAt || new Date(),
              applicantName,
              data,
            });

            if (counts[normalizedType] !== undefined) {
              counts[normalizedType] += 1;
            }
          }
        }
      } catch (typeError) {
        console.error(`❌ Error processing ${appType}:`, typeError.message);
        // Continue with other application types
      }
    }
    
    console.log(`✅ Loaded ${allApplications.length} total submissions across all application types`);
    console.log("📊 Application counts:", counts);
  } catch (error) {
    console.error("❌ Error loading applications:", error);
    console.error("Error details:", error.message);
  }

  if (ctpoCountEl) ctpoCountEl.textContent = counts.CTPO.toString();
  if (pltpCountEl) pltpCountEl.textContent = counts.PLTP.toString();
  if (spltCountEl) spltCountEl.textContent = counts.SPLT.toString();
  if (ptcCountEl) ptcCountEl.textContent = counts["Permit to Cut"].toString();
  if (chainsawCountEl)
    chainsawCountEl.textContent = counts.Chainsaw.toString();
  if (totalApplicationsEl)
    totalApplicationsEl.textContent = allApplications.length.toString();

  const pendingCount = allApplications.filter((app) =>
    app.status.toLowerCase().includes("pending")
  ).length;
  const approvedCount = allApplications.filter((app) =>
    app.status.toLowerCase().includes("approved")
  ).length;

  if (pendingApplicationsEl)
    pendingApplicationsEl.textContent = pendingCount.toString();
  if (approvedApplicationsEl)
    approvedApplicationsEl.textContent = approvedCount.toString();
}

// ---------- Load Appointments Data ----------
async function loadAppointmentsData() {
  const snapshot = await getDocs(appointmentsRef);
  const appointmentDocs = snapshot.docs;

  allAppointments = appointmentDocs.map((doc) => {
    const data = doc.data();
    const createdAt =
      parseTimestamp(data.createdAt) ||
      parseTimestamp(data.timestamp) ||
      parseTimestamp(data.date) ||
      null;
    const scheduledAt =
      parseTimestamp(data.scheduledAt) ||
      parseTimestamp(data.schedule) ||
      parseTimestamp(data.appointmentDate) ||
      null;

    return {
      id: doc.id,
      appointmentType: data.appointmentType || data.type || "General",
      status: formatStatus(data.status || "Pending"),
      location: data.location || data.municipality || "Unspecified",
      createdAt,
      scheduledAt,
      applicantId: data.applicantId || null,
      foresterIds: data.foresterIds || data.foresterId || null,
      raw: data,
    };
  });

  const treePromises = appointmentDocs.map(async (doc) => {
    const appointmentData = doc.data();
    const treeRef = collection(db, `appointments/${doc.id}/tree_inventory`);
    const treeSnap = await getDocs(treeRef);

    return treeSnap.docs
      .map((treeDoc) =>
        normalizeTreeFromAppointment(
          treeDoc.data(),
          treeDoc.id,
          doc.id,
          appointmentData
        )
      )
      .filter(Boolean);
  });

  const appointmentTrees = await Promise.all(treePromises);
  return appointmentTrees.flat();
}

// ---------- Update Top Performers ----------
function updateTopPerformers(foresterMap, speciesMap, locationMap) {
  // Find top forester
  let topForesterName = 'N/A';
  let maxForesterCount = 0;
  for (const [name, count] of Object.entries(foresterMap)) {
    if (count > maxForesterCount) {
      maxForesterCount = count;
      topForesterName = name;
    }
  }
  topForesterEl.textContent = topForesterName;
  topForesterCountEl.textContent = `${maxForesterCount} trees tagged`;
  
  // Find top species
  let topSpeciesName = 'N/A';
  let maxSpeciesCount = 0;
  for (const [species, count] of Object.entries(speciesMap)) {
    if (count > maxSpeciesCount) {
      maxSpeciesCount = count;
      topSpeciesName = species;
    }
  }
  topSpeciesEl.textContent = topSpeciesName;
  topSpeciesCountEl.textContent = `${maxSpeciesCount} trees`;
  
  // Find top location
  let topLocationName = 'N/A';
  let maxLocationCount = 0;
  for (const [location, count] of Object.entries(locationMap)) {
    if (count > maxLocationCount) {
      maxLocationCount = count;
      topLocationName = location;
    }
  }
  topLocationEl.textContent = topLocationName;
  topLocationCountEl.textContent = `${maxLocationCount} trees`;
}

// ---------- Draw Status Chart ----------
function drawStatusChart() {
  // Destroy existing chart instance
  if (statusChartInstance) {
    statusChartInstance.destroy();
  }
  
  const statusMap = {};
  
  allApplications.forEach(app => {
    const status = app.status || 'Pending';
    statusMap[status] = (statusMap[status] || 0) + 1;
  });
  
  const labels = Object.keys(statusMap);
  const data = Object.values(statusMap);
  
  const ctx = document.getElementById('statusChart');
  if (!ctx) {
    console.error('Status chart canvas not found');
    return;
  }
  
  statusChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          'rgba(46, 204, 113, 0.8)',
          'rgba(52, 152, 219, 0.8)',
          'rgba(231, 76, 60, 0.8)',
          'rgba(241, 196, 15, 0.8)'
        ],
        borderColor: '#fff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        title: { display: false }
      }
    }
  });
}

// ---------- Draw Appointment Type Chart ----------
function drawAppointmentTypeChart() {
  // Destroy existing chart instance
  if (appointmentTypeChartInstance) {
    appointmentTypeChartInstance.destroy();
  }
  
  const typeMap = {};
  
  allAppointments.forEach(apt => {
    const type = apt.appointmentType || apt.type || 'General';
    typeMap[type] = (typeMap[type] || 0) + 1;
  });
  
  const labels = Object.keys(typeMap);
  const data = Object.values(typeMap);
  
  const ctx = document.getElementById('appointmentTypeChart');
  if (!ctx) {
    console.error('Appointment type chart canvas not found');
    return;
  }
  
  appointmentTypeChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Appointments',
        data: data,
        backgroundColor: 'rgba(46, 204, 113, 0.7)',
        borderColor: 'rgba(46, 204, 113, 1)',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { 
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      },
      plugins: {
        legend: { display: false },
        title: { display: false }
      }
    }
  });
}

// ---------- Load Data with Caching ----------
async function loadData(forceRefresh = false) {
  console.log('🔄 Loading dashboard data...');
  
  if (!forceRefresh) {
    // Try to load from cache
    const cachedTrees = sessionStorage.getItem(CACHE_KEYS.TREES);
    const cachedApps = sessionStorage.getItem(CACHE_KEYS.APPLICATIONS);
    const cachedAppts = sessionStorage.getItem(CACHE_KEYS.APPOINTMENTS);
    const cachedUsers = sessionStorage.getItem(CACHE_KEYS.USER_DIRECTORY);
    
    if (cachedTrees && cachedApps && cachedAppts && cachedUsers) {
      console.log("📦 Loading dashboard data from cache...");
      
      // Parse cached data
      allTrees = JSON.parse(cachedTrees);
      allApplications = JSON.parse(cachedApps);
      allAppointments = JSON.parse(cachedAppts);
      
      // Restore userDirectory Map
      const userArray = JSON.parse(cachedUsers);
      userDirectory = new Map(userArray);
      
      // Parse date strings back to Date objects for trees
      allTrees = allTrees.map(tree => ({
        ...tree,
        date_tagged: tree.date_tagged ? new Date(tree.date_tagged) : null
      }));
      
      // Parse date strings back to Date objects for applications
      allApplications = allApplications.map(app => ({
        ...app,
        createdAt: app.createdAt ? new Date(app.createdAt) : null
      }));
      
      // Parse date strings back to Date objects for appointments
      allAppointments = allAppointments.map(appt => ({
        ...appt,
        createdAt: appt.createdAt ? new Date(appt.createdAt) : null,
        scheduledAt: appt.scheduledAt ? new Date(appt.scheduledAt) : null
      }));
      
      // Render UI with cached data
      renderDashboard();
      return;
    }
  }
  
  // Load from Firebase
  console.log("🔄 Fetching dashboard data from Firebase...");
  await loadTreeStats();
  
  // Save to cache
  sessionStorage.setItem(CACHE_KEYS.TREES, JSON.stringify(allTrees));
  sessionStorage.setItem(CACHE_KEYS.APPLICATIONS, JSON.stringify(allApplications));
  sessionStorage.setItem(CACHE_KEYS.APPOINTMENTS, JSON.stringify(allAppointments));
  sessionStorage.setItem(CACHE_KEYS.USER_DIRECTORY, JSON.stringify([...userDirectory]));
  sessionStorage.setItem(CACHE_KEYS.TIMESTAMP, new Date().toISOString());
  
  console.log("✅ Dashboard data cached successfully");
}

// ---------- Refresh Data ----------
async function refreshData() {
  console.log("🔄 Refreshing dashboard data...");
  
  // Clear cache
  sessionStorage.removeItem(CACHE_KEYS.TREES);
  sessionStorage.removeItem(CACHE_KEYS.APPLICATIONS);
  sessionStorage.removeItem(CACHE_KEYS.APPOINTMENTS);
  sessionStorage.removeItem(CACHE_KEYS.USER_DIRECTORY);
  sessionStorage.removeItem(CACHE_KEYS.TIMESTAMP);
  
  // Reload data
  await loadData(true);
  
  alert("Dashboard data refreshed successfully!");
}

// ---------- Render Dashboard (used when loading from cache) ----------
function renderDashboard() {
  // Calculate stats
  let totalForestersCount = 0;
  let totalApplicantsCount = 0;
  
  userDirectory.forEach((data) => {
    const role = data.role ? data.role.toString().trim().toLowerCase() : "";
    if (role === "forester") {
      totalForestersCount += 1;
    } else if (role === "applicant") {
      totalApplicantsCount += 1;
    }
  });
  
  if (totalForester) totalForester.textContent = totalForestersCount.toString();
  if (totalApplicants) totalApplicants.textContent = totalApplicantsCount.toString();
  if (totalTaggedEl) totalTaggedEl.textContent = allTrees.length.toString();
  
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const treesThisMonth = allTrees.filter((tree) => {
    const taggedAt = parseTimestamp(tree.date_tagged || tree.taggedAt || tree.timestamp);
    return taggedAt && taggedAt >= thisMonth;
  });

  const treesLastMonth = allTrees.filter((tree) => {
    const taggedAt = parseTimestamp(tree.date_tagged || tree.taggedAt || tree.timestamp);
    return taggedAt && taggedAt >= lastMonth && taggedAt < thisMonth;
  });

  if (treesTaggedThisMonthEl) treesTaggedThisMonthEl.textContent = treesThisMonth.length.toString();

  const thisMonthTreesEl = document.getElementById("thisMonthTrees");
  const lastMonthTreesEl = document.getElementById("lastMonthTrees");
  const treeGrowthEl = document.getElementById("growthPercentage");

  if (thisMonthTreesEl) thisMonthTreesEl.textContent = treesThisMonth.length.toString();
  if (lastMonthTreesEl) lastMonthTreesEl.textContent = treesLastMonth.length.toString();
  if (treeGrowthEl) {
    const treeGrowth = treesLastMonth.length > 0
      ? (((treesThisMonth.length - treesLastMonth.length) / treesLastMonth.length) * 100).toFixed(1)
      : "0";
    treeGrowthEl.textContent = `${treeGrowth}%`;
  }

  const appsThisMonth = allApplications.filter((app) => {
    const createdAt = parseTimestamp(app.createdAt);
    return createdAt && createdAt >= thisMonth;
  });

  const appsLastMonth = allApplications.filter((app) => {
    const createdAt = parseTimestamp(app.createdAt);
    return createdAt && createdAt >= lastMonth && createdAt < thisMonth;
  });

  if (applicationsThisMonthEl) applicationsThisMonthEl.textContent = appsThisMonth.length.toString();
  if (applicationsLastMonthEl) applicationsLastMonthEl.textContent = appsLastMonth.length.toString();
  if (applicationGrowthEl) {
    const growthPercent = appsLastMonth.length > 0
      ? (((appsThisMonth.length - appsLastMonth.length) / appsLastMonth.length) * 100).toFixed(1)
      : "0";
    applicationGrowthEl.textContent = `${growthPercent}%`;
  }
  
  // Application type counts
  const counts = { CTPO: 0, PLTP: 0, SPLT: 0, "Permit to Cut": 0, Chainsaw: 0 };
  allApplications.forEach(app => {
    if (counts[app.type] !== undefined) {
      counts[app.type] += 1;
    }
  });
  
  if (ctpoCountEl) ctpoCountEl.textContent = counts.CTPO.toString();
  if (pltpCountEl) pltpCountEl.textContent = counts.PLTP.toString();
  if (spltCountEl) spltCountEl.textContent = counts.SPLT.toString();
  if (ptcCountEl) ptcCountEl.textContent = counts["Permit to Cut"].toString();
  if (chainsawCountEl) chainsawCountEl.textContent = counts.Chainsaw.toString();
  if (totalApplicationsEl) totalApplicationsEl.textContent = allApplications.length.toString();

  const pendingCount = allApplications.filter((app) => app.status.toLowerCase().includes("pending")).length;
  const approvedCount = allApplications.filter((app) => app.status.toLowerCase().includes("approved")).length;

  if (pendingApplicationsEl) pendingApplicationsEl.textContent = pendingCount.toString();
  if (approvedApplicationsEl) approvedApplicationsEl.textContent = approvedCount.toString();

  const activeAppts = allAppointments.filter((apt) => {
    const status = apt.status ? apt.status.toLowerCase() : "";
    return status === "active" || status === "scheduled";
  });
  const completedAppts = allAppointments.filter((apt) => {
    const status = apt.status ? apt.status.toLowerCase() : "";
    return status === "completed" || status === "done";
  });

  if (activeAppointmentsEl) activeAppointmentsEl.textContent = activeAppts.length.toString();
  if (completedAppointmentsEl) completedAppointmentsEl.textContent = completedAppts.length.toString();

  const avgTreesPerForester = totalForestersCount > 0
    ? (allTrees.length / totalForestersCount).toFixed(1)
    : "0";
  if (avgTreesPerForesterEl) avgTreesPerForesterEl.textContent = avgTreesPerForester;
  if (avgTreesEl) avgTreesEl.textContent = avgTreesPerForester;

  const speciesMap = {};
  const foresterMap = {};
  const locationMap = {};
  const trendMap = {};

  allTrees.forEach((tree) => {
    const species = tree.specie || tree.species || "Unknown";
    speciesMap[species] = (speciesMap[species] || 0) + 1;

    const foresterName = tree.foresterName || "Unknown Forester";
    foresterMap[foresterName] = (foresterMap[foresterName] || 0) + 1;

    const location = tree.municipality || tree.barangay || "Unspecified";
    locationMap[location] = (locationMap[location] || 0) + 1;

    const taggedAt = parseTimestamp(tree.date_tagged || tree.taggedAt || tree.timestamp);
    if (taggedAt) {
      const key = taggedAt.toISOString().split("T")[0];
      trendMap[key] = (trendMap[key] || 0) + 1;
    }
  });

  if (speciesCountEl) speciesCountEl.textContent = Object.keys(speciesMap).length.toString();

  updateTopPerformers(foresterMap, speciesMap, locationMap);
  drawSpeciesChart(Object.keys(speciesMap), Object.values(speciesMap));
  drawForesterChart(Object.keys(foresterMap), Object.values(foresterMap));
  drawStatusChart();
  drawAppointmentTypeChart();

  const sortedTrendKeys = Object.keys(trendMap).sort();
  const sortedTrendValues = sortedTrendKeys.map((key) => trendMap[key]);
  drawTrendChart(sortedTrendKeys, sortedTrendValues);

  populateFilterDropdowns(Object.keys(speciesMap), Object.keys(foresterMap));
  plotTreeLocations(allTrees, { autoFit: false });
  renderLocationStats(locationMap);
  updateRecentActivities();
}

// ---------- Load Stats ----------

async function loadTreeStats() {
  userDirectory = new Map();
  allTrees = [];

  let totalForestersCount = 0;
  let totalApplicantsCount = 0;

  const userSnapshot = await getDocs(usersRef);
  const treePromises = [];

  for (const userDoc of userSnapshot.docs) {
    const data = userDoc.data();
    userDirectory.set(userDoc.id, data);

    const role = data.role ? data.role.toString().trim().toLowerCase() : "";
    if (role === "forester") {
      totalForestersCount += 1;
      treePromises.push(
        fetchUserTrees(userDoc.id)
          .then((trees) =>
            trees
              .map((tree) =>
                normalizeTreeRecord(
                  { id: tree.id, ...tree },
                  data,
                  userDoc.id
                )
              )
              .filter(Boolean)
          )
          .catch((err) => {
            console.warn(`⚠️ Failed to load trees for ${userDoc.id}`, err);
            return [];
          })
      );
    } else if (role === "applicant") {
      totalApplicantsCount += 1;
    }
  }

  const foresterTrees = (await Promise.all(treePromises)).flat();
  allTrees.push(...foresterTrees);

  const appointmentTrees = await loadAppointmentsData();
  if (Array.isArray(appointmentTrees) && appointmentTrees.length) {
    allTrees.push(...appointmentTrees);
  }

  await loadApplicationsData();

  if (totalForester) totalForester.textContent = totalForestersCount.toString();
  if (totalApplicants)
    totalApplicants.textContent = totalApplicantsCount.toString();
  if (totalTaggedEl) totalTaggedEl.textContent = allTrees.length.toString();

  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const treesThisMonth = allTrees.filter((tree) => {
    const taggedAt = parseTimestamp(
      tree.date_tagged || tree.taggedAt || tree.timestamp
    );
    return taggedAt && taggedAt >= thisMonth;
  });

  const treesLastMonth = allTrees.filter((tree) => {
    const taggedAt = parseTimestamp(
      tree.date_tagged || tree.taggedAt || tree.timestamp
    );
    return taggedAt && taggedAt >= lastMonth && taggedAt < thisMonth;
  });

  if (treesTaggedThisMonthEl)
    treesTaggedThisMonthEl.textContent = treesThisMonth.length.toString();

  const thisMonthTreesEl = document.getElementById("thisMonthTrees");
  const lastMonthTreesEl = document.getElementById("lastMonthTrees");
  const treeGrowthEl = document.getElementById("growthPercentage");

  if (thisMonthTreesEl)
    thisMonthTreesEl.textContent = treesThisMonth.length.toString();
  if (lastMonthTreesEl)
    lastMonthTreesEl.textContent = treesLastMonth.length.toString();
  if (treeGrowthEl) {
    const treeGrowth =
      treesLastMonth.length > 0
        ? (
            ((treesThisMonth.length - treesLastMonth.length) /
              treesLastMonth.length) *
            100
          ).toFixed(1)
        : "0";
    treeGrowthEl.textContent = `${treeGrowth}%`;
  }

  const appsThisMonth = allApplications.filter((app) => {
    const createdAt = parseTimestamp(app.createdAt);
    return createdAt && createdAt >= thisMonth;
  });

  const appsLastMonth = allApplications.filter((app) => {
    const createdAt = parseTimestamp(app.createdAt);
    return createdAt && createdAt >= lastMonth && createdAt < thisMonth;
  });

  if (applicationsThisMonthEl)
    applicationsThisMonthEl.textContent = appsThisMonth.length.toString();
  if (applicationsLastMonthEl)
    applicationsLastMonthEl.textContent = appsLastMonth.length.toString();
  if (applicationGrowthEl) {
    const growthPercent =
      appsLastMonth.length > 0
        ? (
            ((appsThisMonth.length - appsLastMonth.length) /
              appsLastMonth.length) *
            100
          ).toFixed(1)
        : "0";
    applicationGrowthEl.textContent = `${growthPercent}%`;
  }

  const activeAppts = allAppointments.filter((apt) => {
    const status = apt.status ? apt.status.toLowerCase() : "";
    return status === "active" || status === "scheduled";
  });
  const completedAppts = allAppointments.filter((apt) => {
    const status = apt.status ? apt.status.toLowerCase() : "";
    return status === "completed" || status === "done";
  });

  if (activeAppointmentsEl)
    activeAppointmentsEl.textContent = activeAppts.length.toString();
  if (completedAppointmentsEl)
    completedAppointmentsEl.textContent = completedAppts.length.toString();

  const avgTreesPerForester =
    totalForestersCount > 0
      ? (allTrees.length / totalForestersCount).toFixed(1)
      : "0";
  if (avgTreesPerForesterEl)
    avgTreesPerForesterEl.textContent = avgTreesPerForester;
  if (avgTreesEl) avgTreesEl.textContent = avgTreesPerForester;

  const speciesMap = {};
  const foresterMap = {};
  const locationMap = {};
  const trendMap = {};

  allTrees.forEach((tree) => {
    const species = tree.specie || tree.species || "Unknown";
    speciesMap[species] = (speciesMap[species] || 0) + 1;

    const foresterName = tree.foresterName || "Unknown Forester";
    foresterMap[foresterName] = (foresterMap[foresterName] || 0) + 1;

    const location = tree.municipality || tree.barangay || "Unspecified";
    locationMap[location] = (locationMap[location] || 0) + 1;

    const taggedAt = parseTimestamp(
      tree.date_tagged || tree.taggedAt || tree.timestamp
    );
    if (taggedAt) {
      const key = taggedAt.toISOString().split("T")[0];
      trendMap[key] = (trendMap[key] || 0) + 1;
    }
  });

  if (speciesCountEl)
    speciesCountEl.textContent = Object.keys(speciesMap).length.toString();

  updateTopPerformers(foresterMap, speciesMap, locationMap);
  drawSpeciesChart(Object.keys(speciesMap), Object.values(speciesMap));
  drawForesterChart(Object.keys(foresterMap), Object.values(foresterMap));
  drawStatusChart();
  drawAppointmentTypeChart();

  const sortedTrendKeys = Object.keys(trendMap).sort();
  const sortedTrendValues = sortedTrendKeys.map((key) => trendMap[key]);
  drawTrendChart(sortedTrendKeys, sortedTrendValues);

  populateFilterDropdowns(Object.keys(speciesMap), Object.keys(foresterMap));
  plotTreeLocations(allTrees, { autoFit: false });
  renderLocationStats(locationMap);
  updateRecentActivities();
}

// ---------- Populate Filters ----------
function populateFilterDropdowns(speciesList, foresterList) {
  console.log('🔍 Populating filter dropdowns...');
  console.log('Species list:', speciesList);
  console.log('Forester list:', foresterList);
  console.log('Total trees for filtering:', allTrees.length);
  
  // Get fresh references to filter elements
  const speciesFilterEl = document.getElementById("speciesFilter");
  const foresterFilterEl = document.getElementById("foresterFilter");
  const applicantFilterEl = document.getElementById("applicantFilter");
  
  if (!speciesFilterEl || !foresterFilterEl || !applicantFilterEl) {
    console.error('❌ Filter elements not found in DOM');
    return;
  }
  
  // Clear existing options (keep only "All" option)
  speciesFilterEl.innerHTML = '<option value="all">All Species</option>';
  foresterFilterEl.innerHTML = '<option value="all">All Foresters</option>';
  applicantFilterEl.innerHTML = '<option value="all">All Applicants</option>';
  
  // Populate species filter
  speciesList.sort().forEach((sp) => {
    const opt = document.createElement("option");
    opt.value = sp;
    opt.textContent = sp;
    speciesFilterEl.appendChild(opt);
  });

  // Populate forester filter
  foresterList.sort().forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = f;
    foresterFilterEl.appendChild(opt);
  });

  // Populate applicant filter
  const applicantSet = new Set();
  allTrees.forEach(tree => {
    if (tree.ownerName && tree.ownerName !== 'Unknown Owner') {
      applicantSet.add(tree.ownerName);
    }
  });
  
  const applicantCount = applicantSet.size;
  Array.from(applicantSet).sort().forEach((applicant) => {
    const opt = document.createElement("option");
    opt.value = applicant;
    opt.textContent = applicant;
    applicantFilterEl.appendChild(opt);
  });

  console.log(`✅ Filters populated: ${speciesList.length} species, ${foresterList.length} foresters, ${applicantCount} applicants`);
  
  // Remove old event listeners by cloning and replacing
  const newSpeciesFilter = speciesFilterEl.cloneNode(true);
  const newForesterFilter = foresterFilterEl.cloneNode(true);
  const newApplicantFilter = applicantFilterEl.cloneNode(true);
  
  speciesFilterEl.parentNode.replaceChild(newSpeciesFilter, speciesFilterEl);
  foresterFilterEl.parentNode.replaceChild(newForesterFilter, foresterFilterEl);
  applicantFilterEl.parentNode.replaceChild(newApplicantFilter, applicantFilterEl);
  
  // Add event listeners to new elements
  newSpeciesFilter.addEventListener("change", applyMapFilters);
  newForesterFilter.addEventListener("change", applyMapFilters);
  newApplicantFilter.addEventListener("change", applyMapFilters);
  
  console.log('✅ Filter event listeners attached');
}

// ---------- Apply Map Filters ----------
function applyMapFilters() {
  console.log('🗺️ Applying map filters...');
  
  // Get fresh references to filter elements
  const speciesFilterEl = document.getElementById("speciesFilter");
  const foresterFilterEl = document.getElementById("foresterFilter");
  const applicantFilterEl = document.getElementById("applicantFilter");
  
  if (!speciesFilterEl || !foresterFilterEl || !applicantFilterEl) {
    console.error('❌ Filter elements not found');
    return;
  }
  
  const selectedSpecies = speciesFilterEl.value;
  const selectedForester = foresterFilterEl.value;
  const selectedApplicant = applicantFilterEl.value;

  console.log('Filter values:', {
    species: selectedSpecies,
    forester: selectedForester,
    applicant: selectedApplicant
  });

  let filtered = allTrees.filter((tree) => {
    // Species filter match
    const treeSpecies = tree.specie || tree.species || "Unknown";
    const speciesMatch = selectedSpecies === "all" || treeSpecies === selectedSpecies;
    
    // Forester filter match
    const treeForester = tree.foresterName || "Unknown Forester";
    const foresterMatch = selectedForester === "all" || treeForester === selectedForester;
    
    // Applicant filter match
    const treeApplicant = tree.ownerName || "Unknown Owner";
    const applicantMatch = selectedApplicant === "all" || treeApplicant === selectedApplicant;
    
    return speciesMatch && foresterMatch && applicantMatch;
  });

  console.log(`📊 Filtered ${filtered.length} trees from ${allTrees.length} total`);
  
  // Plot and auto-fit only after user-driven filtering.
  plotTreeLocations(filtered, { autoFit: true });
  
  // Update filter summary display
  updateFilterSummary(filtered.length, selectedSpecies, selectedForester, selectedApplicant);
}

// ---------- Update Filter Summary ----------
function updateFilterSummary(count, species, forester, applicant) {
  const mapContainer = document.querySelector('.map-container');
  if (!mapContainer) return;
  
  let existingSummary = document.getElementById('filterSummary');
  if (!existingSummary) {
    existingSummary = document.createElement('div');
    existingSummary.id = 'filterSummary';
    existingSummary.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(255, 255, 255, 0.95);
      padding: 10px 15px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 1000;
      font-size: 14px;
      max-width: 250px;
    `;
    mapContainer.appendChild(existingSummary);
  }
  
  const filters = [];
  if (species !== 'all') filters.push(`Species: ${species}`);
  if (forester !== 'all') filters.push(`Forester: ${forester}`);
  if (applicant !== 'all') filters.push(`Applicant: ${applicant}`);
  
  const filterText = filters.length > 0 
    ? `<strong>Active Filters:</strong><br>${filters.join('<br>')}<br>` 
    : '';
  
  existingSummary.innerHTML = `
    ${filterText}
    <strong>Showing:</strong> ${count} tree${count !== 1 ? 's' : ''}
  `;
}

// ---------- Helper: Calculate distance ----------
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// ---------- Plot Trees ----------
function plotTreeLocations(trees, options = {}) {
  const { autoFit = false } = options;

  if (!map) {
    console.error('❌ Map not initialized');
    initMap();
  }
  
  markersLayer.clearLayers();
  
  console.log(`🗺️ Plotting ${trees.length} trees on the map`);

  let markersAdded = 0;
  let invalidCoordinates = 0;
  
  trees.forEach((tree, index) => {
    const lat = parseFloat(tree.latitude);
    const lng = parseFloat(tree.longitude);
    
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      const species = tree.specie || tree.species || "Unknown";
      const treeId = tree.tree_no || tree.tree_id || tree.id || `Tree ${index + 1}`;
      const foresterName = tree.foresterName || "Unknown Forester";
      const applicantName = tree.ownerName || "Unknown Owner";
      const location = tree.barangay || tree.municipality || "N/A";
      const diameter = tree.diameter ? `${tree.diameter} cm` : "N/A";
      const height = tree.height ? `${tree.height} m` : "N/A";
      const volume = tree.volume ? `${tree.volume.toFixed(2)} m³` : "N/A";
      const status = tree.tree_status || tree.status || "N/A";
      
      // Create custom icon based on tree status
      let iconColor = '#2e7d32'; // default green
      if (status.toLowerCase().includes('ready')) {
        iconColor = '#4caf50'; // bright green for ready
      } else if (status.toLowerCase().includes('not')) {
        iconColor = '#ff9800'; // orange for not ready
      }
      
      const customIcon = L.divIcon({
        className: 'custom-tree-marker',
        html: `<div style="background-color: ${iconColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });
      
      const popup = `
        <div style="min-width: 200px;">
          <h4 style="margin: 0 0 10px 0; color: #2e7d32; border-bottom: 2px solid #2e7d32; padding-bottom: 5px;">
            🌳 ${species}
          </h4>
          <table style="width: 100%; font-size: 13px; line-height: 1.6;">
            <tr><td style="font-weight: 600; width: 40%;">Tree ID:</td><td>${treeId}</td></tr>
            <tr><td style="font-weight: 600;">Status:</td><td>${status}</td></tr>
            <tr><td style="font-weight: 600;">Diameter:</td><td>${diameter}</td></tr>
            <tr><td style="font-weight: 600;">Height:</td><td>${height}</td></tr>
            <tr><td style="font-weight: 600;">Volume:</td><td>${volume}</td></tr>
            <tr><td style="font-weight: 600;">Forester:</td><td>${foresterName}</td></tr>
            <tr><td style="font-weight: 600;">Applicant:</td><td>${applicantName}</td></tr>
            <tr><td style="font-weight: 600;">Location:</td><td>${location}</td></tr>
          </table>
        </div>
      `;
      
      L.marker([lat, lng], { icon: customIcon })
        .bindPopup(popup)
        .addTo(markersLayer);
      markersAdded++;
    } else {
      invalidCoordinates++;
    }
  });
  
  console.log(`✅ Successfully added ${markersAdded} markers to the map`);
  if (invalidCoordinates > 0) {
    console.warn(`⚠️ ${invalidCoordinates} trees had invalid coordinates`);
  }

  if (autoFit) {
    if (markersLayer.getLayers().length > 0) {
      map.fitBounds(markersLayer.getBounds(), { padding: [40, 40] });
    } else {
      console.warn('⚠️ No markers were added to the map');
      map.setView([18.3, 121.7], 9);
    }
  }
}

// ---------- Charts ----------
function drawSpeciesChart(labels, values) {
  // Destroy existing chart instance
  if (speciesChartInstance) {
    speciesChartInstance.destroy();
  }
  
  const ctx = document.getElementById("speciesChart");
  if (!ctx) {
    console.error('Species chart canvas not found');
    return;
  }
  
  speciesChartInstance = new Chart(ctx, {
    type: "pie",
    data: { 
      labels, 
      datasets: [{ 
        data: values, 
        backgroundColor: [
          '#4caf50', '#81c784', '#66bb6a', '#43a047', '#2e7d32',
          '#1b5e20', '#a5d6a7', '#c8e6c9'
        ],
        borderColor: '#fff',
        borderWidth: 2
      }] 
    },
    options: { 
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { position: 'right' }
      }
    },
  });
}

function drawForesterChart(labels, values) {
  // Destroy existing chart instance
  if (foresterChartInstance) {
    foresterChartInstance.destroy();
  }
  
  const ctx = document.getElementById("applicantChart");
  if (!ctx) {
    console.error('Forester chart canvas not found');
    return;
  }
  
  foresterChartInstance = new Chart(ctx, {
    type: "bar",
    data: { 
      labels, 
      datasets: [{ 
        label: 'Trees Tagged',
        data: values, 
        backgroundColor: "#81c784",
        borderColor: '#4caf50',
        borderWidth: 1
      }] 
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      indexAxis: "y",
      scales: {
        x: { 
          beginAtZero: true,
          ticks: { stepSize: 5 }
        }
      }
    },
  });
}

function drawTrendChart(labels, values) {
  // Destroy existing chart instance
  if (trendChartInstance) {
    trendChartInstance.destroy();
  }
  
  const ctx = document.getElementById("trendsChart");
  if (!ctx) {
    console.error('Trend chart canvas not found');
    return;
  }
  
  trendChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Trees Tagged Over Time",
          data: values,
          borderColor: "#4caf50",
          backgroundColor: "rgba(76,175,80,0.2)",
          tension: 0.3,
          fill: true,
          pointBackgroundColor: "#4caf50",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        },
      ],
    },
    options: { 
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: true, position: 'top' }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 2 }
        }
      }
    },
  });
}

// ---------- Update Recent Activities ----------
function updateRecentActivities() {
  const activitiesList = document.getElementById('recentActivities');
  if (!activitiesList) return;
  
  activitiesList.innerHTML = '';
  
  // Combine all activities
  const activities = [];
  
  // Add recent applications
  allApplications.slice(0, 5).forEach(app => {
    const date = app.createdAt instanceof Date ? app.createdAt : new Date(app.createdAt);
    activities.push({
      text: `New ${app.type} application from ${app.applicantName || 'Unknown'}`,
      date: date,
      type: 'application'
    });
  });
  
  // Add recent tree taggings
  const recentTrees = [...allTrees]
    .sort((a, b) => {
      const dateA = a.date_tagged instanceof Date ? a.date_tagged : new Date(a.date_tagged);
      const dateB = b.date_tagged instanceof Date ? b.date_tagged : new Date(b.date_tagged);
      return dateB - dateA;
    })
    .slice(0, 5);
    
  recentTrees.forEach(tree => {
    const date = tree.date_tagged instanceof Date ? tree.date_tagged : new Date(tree.date_tagged);
    activities.push({
      text: `${tree.specie} tree tagged by ${tree.foresterName} in ${tree.municipality}`,
      date: date,
      type: 'tree'
    });
  });
  
  // Sort by date and take top 10
  activities.sort((a, b) => b.date - a.date);
  const topActivities = activities.slice(0, 10);
  
  // Display activities
  if (topActivities.length === 0) {
    activitiesList.innerHTML = '<li>No recent activities</li>';
  } else {
    topActivities.forEach(activity => {
      const li = document.createElement('li');
      const timeAgo = getTimeAgo(activity.date);
      li.textContent = `${activity.text} - ${timeAgo}`;
      activitiesList.appendChild(li);
    });
  }
}

// ---------- Render Location Stats ----------
function renderLocationStats(locationMap) {
  // This function can be used to display location statistics
  // For now, the data is used in the top performers section
  console.log('Location Statistics:', locationMap);
}

// ---------- Helper: Time Ago ----------
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

// ---------- Dashboard Chatbot ----------
function getDashboardMetricText() {
  const totalTrees = totalTaggedEl?.textContent?.trim() || "0";
  const totalApplications = totalApplicationsEl?.textContent?.trim() || "0";
  const pendingApplications = pendingApplicationsEl?.textContent?.trim() || "0";
  const approvedApplications = approvedApplicationsEl?.textContent?.trim() || "0";
  const activeAppointments = activeAppointmentsEl?.textContent?.trim() || "0";
  const completedAppointments = completedAppointmentsEl?.textContent?.trim() || "0";

  return `Current overview: ${totalTrees} tagged trees, ${totalApplications} total applications, ${pendingApplications} pending, ${approvedApplications} approved, ${activeAppointments} active appointments, and ${completedAppointments} completed appointments.`;
}

function setupDashboardChatbot() {
  const toggleBtn = document.getElementById("dashboardChatbotToggle");
  const panel = document.getElementById("dashboardChatbotPanel");
  const minimizeBtn = document.getElementById("dashboardChatbotMinimize");
  const messagesEl = document.getElementById("dashboardChatbotMessages");
  const formEl = document.getElementById("dashboardChatbotForm");
  const inputEl = document.getElementById("dashboardChatbotInput");
  const promptButtons = document.querySelectorAll("[data-dashboard-chatbot-prompt]");

  if (!toggleBtn || !panel || !messagesEl || !formEl || !inputEl) return;

  const addMessage = (sender, text) => {
    const wrapper = document.createElement("div");
    wrapper.className = sender === "user" ? "flex justify-end" : "flex justify-start";

    const bubble = document.createElement("div");
    bubble.className = sender === "user"
      ? "max-w-[85%] rounded-2xl rounded-tr-sm bg-forest-100 px-3 py-2 text-sm font-semibold leading-6 text-forest-900"
      : "max-w-[85%] rounded-2xl rounded-tl-sm bg-forest-700 px-3 py-2 text-sm font-medium leading-6 text-white";
    bubble.textContent = text;

    wrapper.appendChild(bubble);
    messagesEl.appendChild(wrapper);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  const openSectionByIntent = (intent) => {
    const normalized = intent.toLowerCase();
    if (normalized.includes("report")) {
      window.location.href = "reports.html";
      return true;
    }
    if (normalized.includes("tree")) {
      window.location.href = "trees.html";
      return true;
    }
    if (normalized.includes("user") || normalized.includes("forester")) {
      window.location.href = "users.html";
      return true;
    }
    if (normalized.includes("application")) {
      window.location.href = "applications.html";
      return true;
    }
    if (normalized.includes("map")) {
      document.getElementById("mapTitle")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    }
    return false;
  };

  const getReply = (message) => {
    const normalized = message.toLowerCase();

    if (normalized.includes("summary") || normalized.includes("overview")) {
      return getDashboardMetricText();
    }

    if (normalized.includes("pending")) {
      const pending = pendingApplicationsEl?.textContent?.trim() || "0";
      return `There are currently ${pending} pending applications.`;
    }

    if (normalized.includes("approved")) {
      const approved = approvedApplicationsEl?.textContent?.trim() || "0";
      return `There are currently ${approved} approved applications.`;
    }

    if (normalized.includes("report") || normalized.includes("go to") || normalized.includes("open")) {
      const navigated = openSectionByIntent(normalized);
      if (navigated) {
        return "Opening the requested section now.";
      }
    }

    if (normalized.includes("help") || normalized.includes("what can you do")) {
      return "I can summarize dashboard metrics, answer pending/approved counts, and navigate you to reports, applications, users, trees, or the map section.";
    }

    return "I can help with dashboard summary, pending/approved counts, and quick navigation. Try: 'Show me dashboard summary'.";
  };

  const togglePanel = () => {
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) {
      inputEl.focus();
    }
  };

  toggleBtn.addEventListener("click", togglePanel);
  minimizeBtn?.addEventListener("click", togglePanel);

  formEl.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = inputEl.value.trim();
    if (!message) return;

    addMessage("user", message);
    inputEl.value = "";

    setTimeout(() => {
      addMessage("bot", getReply(message));
    }, 350);
  });

  promptButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      inputEl.value = btn.getAttribute("data-dashboard-chatbot-prompt") || "";
      formEl.requestSubmit();
    });
  });
}


// ---------- Initialize ----------
document.addEventListener("DOMContentLoaded", async () => {
  initMap();
  await loadData();
  setupDashboardChatbot();
  
  // Add refresh button handler if it exists
  const refreshBtn = document.getElementById("refreshDashboard");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing...';
      await refreshData();
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '<i class="fa-solid fa-refresh"></i> Refresh Data';
    });
  }
});
