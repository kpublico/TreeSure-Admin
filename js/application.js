import { db, checkLogin, logout } from "./script.js";
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { setCurrentApplicant, setCurrentApplication, setAppointmentMode } from "./treeInventory.js";

// ------------------ INITIALIZATION ------------------
checkLogin();

// ------------------ DOM ELEMENTS (Lazy-loaded) ------------------
let applicantsContainer, filesSection, filesBody, applicantTitle, applicationTypeTitle, applicationTypeHeader;
let submissionSelector, submissionDropdown;
let scheduleContainer, scheduleBtn, scheduleModal, closeModal, saveAppointmentBtn;
let proceedBtn;
let commentBtn, commentModal, closeCommentModal, sendCommentBtn, commentDocumentSelect;
let claimCertificateBtn, claimCertificateModal, closeClaimCertificateModal, sendClaimNotificationBtn;
let claimApplicantName, claimCertificateType, claimMessage, claimRemarks;
let manageTemplatesBtn, templateModal, closeTemplateModal, uploadTemplateFileBtn, templateFileInput;
let templateDocumentType, templateTitle, templateDescription, existingTemplatesList;

let currentOpenUserId = null;
let currentApplicationType = null;
let currentApplicantData = null;
let currentSubmissionId = null;
let availableSubmissions = [];



// ------------------ HELPER ------------------
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function showModal(modalEl) {
  if (modalEl) modalEl.style.display = "flex";
}

function hideModal(modalEl) {
  if (modalEl) modalEl.style.display = "none";
}

function initGlobalModalBehavior() {
  document.querySelectorAll(".modal").forEach((modalEl) => {
    if (modalEl.dataset.modalReady === "1") return;

    modalEl.addEventListener("click", (e) => {
      if (e.target === modalEl) hideModal(modalEl);
    });

    modalEl.querySelectorAll(".close").forEach((closeBtn) => {
      closeBtn.addEventListener("click", () => hideModal(modalEl));
    });

    modalEl.dataset.modalReady = "1";
  });
}

let pdfJsLoadingPromise = null;
async function ensurePdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  if (!pdfJsLoadingPromise) {
    pdfJsLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.async = true;
      script.onload = () => {
        try {
          const workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
          resolve(window.pdfjsLib);
        } catch (err) {
          pdfJsLoadingPromise = null;
          reject(err);
        }
      };
      script.onerror = (err) => {
        pdfJsLoadingPromise = null;
        reject(err);
      };
      document.head.appendChild(script);
    });
  }
  return pdfJsLoadingPromise;
}

// Display templates at application type level (before applicants list)
async function displayApplicationTypeTemplates(appType) {
  try {
    console.log("🔍 Fetching templates for application type:", appType);
    
    // Remove existing template section if any
    document.querySelectorAll("#applicationTemplatesSection").forEach((templateSection) => {
      templateSection.remove();
    });
    
    const templatesRef = collection(db, "applications", appType, "templates");
    const templatesSnap = await getDocs(templatesRef);
    
    if (templatesSnap.empty) {
      console.log("No templates found for", appType);
      return;
    }

    console.log(`📋 Found ${templatesSnap.size} template(s) for ${appType}`);

    // Create template section before applicants container
    const templateSection = document.createElement("div");
    templateSection.id = "applicationTemplatesSection";
    templateSection.style.cssText = `
      background: #f0f8e8;
      border: 2px solid #2d5016;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    `;
    
    let templatesHtml = `
      <h3 style="margin: 0 0 15px 0; color: #2d5016; display: flex; align-items: center; gap: 10px;">
        <span>📋 Available Document Templates</span>
      </h3>
      <p style="margin: 0 0 15px 0; color: #666; font-size: 0.9em;">
        Download these templates before applicants submit their documents:
      </p>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">
    `;

    // Display each template as a card
    templatesSnap.forEach((templateDoc) => {
      const templateData = templateDoc.data();
      const templateId = templateDoc.id;
      
      const documentType = templateData.documentType || templateId;
      const title = templateData.title || "Template";
      const description = templateData.description || "";
      const fileName = templateData.fileName || "Unknown";
      const url = templateData.url || "";
      
      if (!url || url.trim() === "") return;

      templatesHtml += `
        <div style="background: white; border: 1px solid #ddd; border-radius: 6px; padding: 15px; transition: all 0.3s;" class="template-card">
          <div style="font-weight: bold; color: #2d5016; margin-bottom: 8px; font-size: 1em;">
            📄 ${escapeHtml(documentType)}
          </div>
          <div style="font-size: 0.9em; color: #666; margin-bottom: 5px;">
            ${escapeHtml(title)}
          </div>
          ${description ? `<div style="font-size: 0.85em; color: #888; font-style: italic; margin-bottom: 10px;">${escapeHtml(description)}</div>` : ''}
          <div style="font-size: 0.85em; color: #999; margin-bottom: 10px;">
            📁 ${escapeHtml(fileName)}
          </div>
          <button class="action-btn-secondary template-download-btn" data-url="${escapeHtml(url)}" style="
            background: #2d5016;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9em;
            width: 100%;
          ">
            📥 Download Template
          </button>
        </div>
      `;
    });

    templatesHtml += `
      </div>
    `;
    
    templateSection.innerHTML = templatesHtml;
    
    // Insert before applicants container
    const container = document.getElementById("applicantsContainer");
    if (container && container.parentNode) {
      container.parentNode.insertBefore(templateSection, container);
    }
    
    // Add download handlers
    templateSection.querySelectorAll(".template-download-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const url = btn.dataset.url;
        if (url) {
          window.open(url, "_blank");
        }
      });
    });
    
    // Add hover effect
    const style = document.createElement('style');
    style.textContent = `
      .template-card:hover {
        box-shadow: 0 2px 8px rgba(45,80,22,0.2);
        transform: translateY(-2px);
      }
    `;
    if (!document.getElementById('template-card-styles')) {
      style.id = 'template-card-styles';
      document.head.appendChild(style);
    }

  } catch (err) {
    console.error("❌ Error loading application templates:", err);
  }
}

// Display application-level templates at the top of the files table (DEPRECATED - keeping for backward compatibility)
async function displayApplicationTemplates(appType) {
  try {
    console.log("🔍 Fetching templates for application type:", appType);
    
    const templatesRef = collection(db, "applications", appType, "templates");
    const templatesSnap = await getDocs(templatesRef);
    
    if (templatesSnap.empty) {
      console.log("No templates found for", appType);
      return;
    }

    console.log(`📋 Found ${templatesSnap.size} template(s) for ${appType}`);

    // Add a header row for templates
    const headerRow = document.createElement("tr");
    headerRow.style.backgroundColor = "#f0f8e8";
    headerRow.innerHTML = `
      <td colspan="4" style="font-weight:bold; color:#2d5016; padding:10px; text-align:center;">
        📋 Available Templates (Download before uploading)
      </td>
    `;
    filesBody.appendChild(headerRow);

    // Display each template
    for (const templateDoc of templatesSnap.docs) {
      const templateData = templateDoc.data();
      const templateId = templateDoc.id;
      
      const documentType = templateData.documentType || templateId;
      const title = templateData.title || "Template";
      const description = templateData.description || "";
      const fileName = templateData.fileName || "Unknown";
      const url = templateData.url || "";
      
      if (!url || url.trim() === "") {
        console.log(`⏭️ Skipping template "${templateId}" - no URL`);
        continue;
      }

      const tr = document.createElement("tr");
      tr.style.backgroundColor = "#fafff5";
      tr.innerHTML = `
        <td>
          <strong>📄 ${escapeHtml(documentType)}</strong><br/>
          <small style="color:#666;">${escapeHtml(title)}</small>
          ${description ? `<br/><small style="color:#888; font-style:italic;">${escapeHtml(description)}</small>` : ''}
        </td>
        <td><span style="color:#2d5016;">📥 ${escapeHtml(fileName)}</span></td>
        <td><span style="color:#666;">Template</span></td>
        <td>
          <button class="action-btn-secondary template-download-btn" data-url="${escapeHtml(url)}" style="background:#2d5016; color:white;">
            📥 Download Template
          </button>
        </td>
      `;

      // Add download handler
      tr.querySelector(".template-download-btn").addEventListener("click", () => {
        const templateUrl = url;
        if (templateUrl && templateUrl.trim() !== "") {
          window.open(templateUrl, "_blank");
        } else {
          alert("Template URL not available.");
        }
      });

      filesBody.appendChild(tr);
    }

    // Add a separator row
    const separatorRow = document.createElement("tr");
    separatorRow.innerHTML = `
      <td colspan="4" style="border-top:2px solid #2d5016; padding:10px; text-align:center; font-weight:bold; color:#2d5016;">
        📤 Uploaded Documents
      </td>
    `;
    filesBody.appendChild(separatorRow);

  } catch (err) {
    console.error("❌ Error loading application templates:", err);
  }
}

// Load foresters for assignment
async function loadForesters(selectElement) {
  selectElement.innerHTML = "";
  const q = query(
    collection(db, "users"),
    where("role", "==", "Forester"),
    where("active", "==", true)
  );
  const snapshot = await getDocs(q);

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const opt = document.createElement("option");
    opt.value = docSnap.id;
    opt.textContent = data.name || "Unnamed Forester";
    selectElement.appendChild(opt);
  });
}

// ------------------ FILE URL RESOLVER ------------------
// Tries to get the storage URL of a specific upload for an applicant.
// Priority:
// 1) uploads map inside applications/{type}/applicants/{id} (current structure)
// 2) uploads subcollection applications/{type}/applicants/{id}/uploads/{docLabel} (fallback if you migrate later)
async function getUploadUrl(
  appType,
  applicantId,
  docLabel,
  searchMode = "auto"
) {
  try {
    const tryMap = async () => {
      const applicantRef = doc(
        db,
        "applications",
        appType,
        "applicants",
        applicantId
      );
      const snap = await getDoc(applicantRef);
      if (!snap.exists()) return null;
      const data = snap.data() || {};
      const uploads = data.uploads || {};
      const entry = uploads[docLabel];
      const url = entry?.url || entry?.URL || entry?.Url; // be lenient with casing
      return url || null;
    };

    const trySubcollection = async () => {
      const uploadDocRef = doc(
        db,
        "applications",
        appType,
        "applicants",
        applicantId,
        "uploads",
        docLabel
      );
      const upSnap = await getDoc(uploadDocRef);
      if (!upSnap.exists()) return null;
      const u = upSnap.data() || {};
      return u.url || u.URL || u.Url || null;
    };

    let url = null;
    if (searchMode === "auto" || searchMode === "map") {
      url = await tryMap();
      if (url) {
        console.log("✅ URL resolved from applicant uploads map:", url);
        return url;
      }
      if (searchMode === "map") return null;
    }

    if (searchMode === "auto" || searchMode === "subcollection") {
      url = await trySubcollection();
      if (url) {
        console.log("✅ URL resolved from uploads subcollection:", url);
        return url;
      }
    }

    console.warn("⚠️ No URL found for", { appType, applicantId, docLabel });
    return null;
  } catch (e) {
    console.error("❌ Error resolving upload URL:", e);
    return null;
  }
}

// ------------------ UNIFIED UPLOADS LOADER ------------------
// Reads uploads from the applicant doc's uploads map first.
// If empty, falls back to the uploads subcollection and returns a normalized object.
async function loadUnifiedUploads(appType, applicantId) {
  try {
    const applicantRef = doc(
      db,
      "applications",
      appType,
      "applicants",
      applicantId
    );
    const applicantSnap = await getDoc(applicantRef);
    let fromMap = {};
    if (applicantSnap.exists()) {
      const data = applicantSnap.data() || {};
      fromMap = data.uploads || {};
    }

    const mapKeys = Object.keys(fromMap);
    if (mapKeys.length > 0) {
      console.log("📥 Using uploads from map (count):", mapKeys.length);
      return { uploads: fromMap, source: "map" };
    }

    // Fallback: check subcollection
    const uploadsColRef = collection(
      db,
      "applications",
      appType,
      "applicants",
      applicantId,
      "uploads"
    );
    const subSnap = await getDocs(uploadsColRef);

    if (subSnap.empty) {
      console.warn("⚠️ No uploads found in map or subcollection for:", {
        appType,
        applicantId,
      });
      return { uploads: {}, source: "none" };
    }

    const normalized = {};
    subSnap.forEach((d) => {
      const u = d.data() || {};
      const key = d.id; // subcollection doc id
      normalized[key] = {
        title: u.title || key,
        fileName: u.fileName || u.name || "Unknown",
        uploadedAt: u.uploadedAt || u.createdAt || u.timestamp || null,
        url: u.url || u.URL || u.Url || null,
        ...u,
      };
    });
    console.log(
      "📥 Using uploads from subcollection (count):",
      Object.keys(normalized).length
    );
    return { uploads: normalized, source: "subcollection" };
  } catch (e) {
    console.error("❌ Error loading unified uploads:", e);
    return { uploads: {}, source: "error" };
  }
}

// ------------------ LOAD APPLICATION STATS ------------------
async function loadApplicationStats() {
  const appsRef = collection(db, "applications");
  const snapshot = await getDocs(appsRef);

  const stats = {};
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    stats[docSnap.id] = {
      uploadedCount: data.uploadedCount || 0,
      lastUpdated: data.lastUpdated?.toDate
        ? data.lastUpdated.toDate().toLocaleString()
        : "N/A",
    };
  });

  console.log("📊 Application Stats:", stats);
  renderDashboardStats(stats);
}

// ------------------ RENDER DASHBOARD STATS ------------------
function renderDashboardStats(stats) {
  const dashboard = document.getElementById("dashboardStats");
  if (!dashboard) return;

  dashboard.innerHTML = `
    <h2>📈 Application Overview</h2>
    <table class="stats-table">
      <thead>
        <tr>
          <th>Application Type</th>
          <th>Uploaded Count</th>
          <th>Last Updated</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(stats)
          .map(
            ([type, data]) => `
          <tr>
            <td>${type.toUpperCase()}</td>
            <td>${data.uploadedCount}</td>
            <td>${data.lastUpdated}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

// ------------------ LOAD APPLICANTS ------------------
async function loadApplicants(type = "ctpo") {
  applicationTypeHeader.style.display = "block";
  applicationTypeTitle.style.display = "inline-block";
  applicantsContainer.style.display = "flex";
  applicantsContainer.style.flexWrap = "wrap";
  applicantsContainer.style.justifyContent = "flex-start";
  filesSection.style.display = "none";
  scheduleContainer.style.display = "none";

  currentApplicationType = type;
  localStorage.setItem("lastApplicationType", type);
  applicationTypeTitle.textContent = `${type.toUpperCase()} Applications`;

  applicantsContainer.innerHTML = `<div style="width:100%; text-align:center;"><span class="spinner"></span> Loading ${type.toUpperCase()} applicants...</div>`;

  // Display available templates for this application type
  await displayApplicationTypeTemplates(type);

  try {
    const appDoc = doc(db, "applications", type);
    const applicantsSnap = await getDocs(collection(appDoc, "applicants"));

    applicantsContainer.innerHTML = "";

    if (applicantsSnap.empty) {
      applicantsContainer.innerHTML = `<p style="width:100%; text-align:center;">No ${type.toUpperCase()} applicants yet.</p>`;
      return;
    }

    applicantsSnap.forEach((applicantDoc) => {
      const applicantData = applicantDoc.data();
      const submissionsCount = applicantData.submissionsCount || 0;

      const folderDiv = document.createElement("div");
      folderDiv.className = "applicant-folder";
      folderDiv.innerHTML = `
        <div class="folder-icon">📁</div>
        <div class="applicant-name">${escapeHtml(
          applicantData.applicantName || "Unnamed Applicant"
        )}</div>
        <div style="font-size:0.85em; color:#666; margin-top:4px;">${submissionsCount} submission${submissionsCount !== 1 ? 's' : ''}</div>
      `;

      folderDiv.addEventListener("click", () => {
        if (currentOpenUserId === applicantDoc.id) hideFiles();
        else
          showApplicantFiles(
            applicantDoc.id,
            applicantData.applicantName,
            applicantData,
            type
          );
      });

      applicantsContainer.appendChild(folderDiv);
    });
  } catch (err) {
    console.error("Error loading applicants:", err);
    applicantsContainer.innerHTML = `<p style='color:red; width:100%; text-align:center;'>Error loading applicants.</p>`;
  }
}

// ------------------ SHOW / HIDE FILES ------------------
function hideFiles() {
  filesSection.style.display = "none";
  filesBody.innerHTML = "";
  applicantTitle.textContent = "";
  scheduleContainer.style.display = "none";
  currentOpenUserId = null;
  appointmentDate.value = "";
  appointmentTime.value = "";
}

async function showApplicantFiles(
  userId,
  userName,
  userData = {},
  type = "ctpo"
) {
  if (currentOpenUserId && currentOpenUserId !== userId) hideFiles();

  filesBody.innerHTML = `<tr><td colspan="5" style="text-align:center;"><span class="spinner"></span> Loading submissions...</td></tr>`;
  filesSection.style.display = "block";
  scheduleContainer.style.display = "flex";
  applicantTitle.textContent = `📂 Submissions of ${userName || "Applicant"}`;
  currentOpenUserId = userId;
  currentApplicationType = type;
  currentApplicantData = userData;

  // Hide all buttons initially until a submission is selected
  if (proceedBtn) proceedBtn.style.display = "none";
  if (commentBtn) commentBtn.style.display = "none";
  if (claimCertificateBtn) claimCertificateBtn.style.display = "none";
  if (scheduleBtn) scheduleBtn.style.display = "none";

  setCurrentApplicant(userId, userData);

  try {
    // Load all submissions for this applicant
    await loadSubmissionsForApplicant(userId, userName, type);
  } catch (err) {
    console.error("❌ Error in showApplicantFiles:", err);
    filesBody.innerHTML = `<tr><td colspan="5" style="color:red;text-align:center">Error loading applicant data: ${err.message}</td></tr>`;
  }
}

// ------------------ LOAD SUBMISSIONS FOR APPLICANT ------------------
async function loadSubmissionsForApplicant(userId, userName, type) {
  try {
    console.log(
      "🔍 Fetching submissions from:",
      `applications/${type}/applicants/${userId}/submissions`
    );
    
    const submissionsRef = collection(db, `applications/${type}/applicants/${userId}/submissions`);
    console.log("📡 Querying submissions...");
    
    const submissionsSnap = await getDocs(query(submissionsRef, orderBy("createdAt", "desc")));
    
    console.log(`✅ Query complete. Found ${submissionsSnap.size} submission(s)`);
    
    availableSubmissions = [];
    
    if (submissionsSnap.empty) {
      console.warn("⚠️ No submissions found");
      filesBody.innerHTML = "";
      
      // Display templates
      await displayApplicationTemplates(type);
      
      const noSubmissionsRow = document.createElement("tr");
      noSubmissionsRow.innerHTML = "<td colspan='4' style='text-align:center; color:#888;'>No submissions have been made yet.</td>";
      filesBody.appendChild(noSubmissionsRow);
      
      // Hide submission selector
      const selector = document.getElementById("submissionSelectorContainer");
      if (selector) selector.style.display = "none";
      return;
    }

    console.log(`📤 Found ${submissionsSnap.size} submission(s). Loading upload counts...`);

    // Build submissions list - count uploads and appointments in parallel for better performance
    const submissionPromises = submissionsSnap.docs.map(async (submissionDoc) => {
      const submissionData = submissionDoc.data();
      
      try {
        // Count uploads in subcollection
        const uploadsRef = collection(db, `applications/${type}/applicants/${userId}/submissions/${submissionDoc.id}/uploads`);
        const uploadsSnap = await getDocs(uploadsRef);
        const uploadCount = uploadsSnap.size;
        
        // Query appointments for this submission
        const appointmentsRef = collection(db, "appointments");
        const appointmentsQuery = query(appointmentsRef, where("applicationID", "==", submissionDoc.id));
        const appointmentsSnap = await getDocs(appointmentsQuery);
        
        const appointments = appointmentsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        return {
          id: submissionDoc.id,
          status: submissionData.status || "draft",
          createdAt: submissionData.createdAt,
          submittedAt: submissionData.submittedAt,
          applicantName: submissionData.applicantName || userName,
          uploadCount: uploadCount,
          appointmentCount: appointments.length,
          appointments: appointments
        };
      } catch (err) {
        console.error(`Error loading data for ${submissionDoc.id}:`, err);
        // Return submission data without upload/appointment count if there's an error
        return {
          id: submissionDoc.id,
          status: submissionData.status || "draft",
          createdAt: submissionData.createdAt,
          submittedAt: submissionData.submittedAt,
          applicantName: submissionData.applicantName || userName,
          uploadCount: 0,
          appointmentCount: 0,
          appointments: []
        };
      }
    });

    // Wait for all submissions to be processed
    availableSubmissions = await Promise.all(submissionPromises);
    
    console.log("✅ Submissions loaded:", availableSubmissions);
    console.log("📊 Number of submissions:", availableSubmissions.length);
    console.log("🔍 First submission:", availableSubmissions[0]);

    // Display submissions as cards (don't auto-load files)
    console.log("🎨 Calling displaySubmissionsList...");
    displaySubmissionsList(userId, type);
    console.log("✅ displaySubmissionsList completed");
    
    // Hide the files table initially
    const filesTable = document.getElementById("filesTable");
    if (filesTable) filesTable.style.display = "none";

  } catch (err) {
    console.error("❌ Error loading submissions:", err);
    filesBody.innerHTML =
      "<tr><td colspan='4' style='color:red;text-align:center'>Error loading submissions: " + err.message + "</td></tr>";
  }
}

// ------------------ DISPLAY SUBMISSIONS LIST ------------------
function displaySubmissionsList(userId, type) {
  console.log("📝 displaySubmissionsList called with:", { userId, type, submissionsCount: availableSubmissions.length });
  
  let listContainer = document.getElementById("submissionSelectorContainer");
  console.log("🔍 Looking for submissionSelectorContainer:", listContainer);
  
  // Create list container if it doesn't exist
  if (!listContainer) {
    console.log("🆕 Creating new submissionSelectorContainer");
    listContainer = document.createElement("div");
    listContainer.id = "submissionSelectorContainer";
    listContainer.style.cssText = `
      margin-bottom: 20px;
    `;

    // Insert before the table (or its wrapper) using the correct parent node.
    const filesSection = document.getElementById("filesSection");
    const filesTable = document.getElementById("filesTable");
    console.log("🔍 Found filesSection:", !!filesSection, "filesTable:", !!filesTable);
    if (filesSection && filesTable) {
      const tableAnchor = filesTable.closest(".overflow-x-auto") || filesTable;
      const anchorParent = tableAnchor.parentElement;

      if (anchorParent) {
        anchorParent.insertBefore(listContainer, tableAnchor);
        console.log("✅ Container inserted before files table anchor");
      } else {
        filesSection.appendChild(listContainer);
        console.log("⚠️ Could not resolve anchor parent; appended to filesSection");
      }
    } else {
      console.error("❌ Could not find filesSection or filesTable!");
      if (filesSection) {
        filesSection.appendChild(listContainer);
        console.log("⚠️ Appended to filesSection instead");
      }
    }
  }
  
  listContainer.style.display = "block";
  console.log("📦 Container display set to block");
  
  // Build submission cards
  console.log("🎨 Building submission cards HTML for", availableSubmissions.length, "submissions");
  const cardsHtml = availableSubmissions.map((submission) => {
    const statusBadge = submission.status === "submitted" 
      ? '<span style="background:#4caf50; color:white; padding:4px 8px; border-radius:4px; font-size:0.85em;">✓ Submitted</span>'
      : '<span style="background:#ff9800; color:white; padding:4px 8px; border-radius:4px; font-size:0.85em;">📝 Draft</span>';
    
    const createdDate = submission.createdAt?.toDate 
      ? submission.createdAt.toDate().toLocaleString()
      : "N/A";
    
    const submittedDate = submission.submittedAt?.toDate 
      ? submission.submittedAt.toDate().toLocaleString()
      : "-";
    
    const isSelected = submission.id === currentSubmissionId;
    const selectedStyle = isSelected ? 'border: 3px solid #2d5016; box-shadow: 0 4px 8px rgba(45,80,22,0.3);' : '';
    
    return `
      <div class="submission-card" data-submission-id="${submission.id}" style="
        background: ${isSelected ? '#f0f8e8' : 'white'};
        border: 2px solid #ddd;
        ${selectedStyle}
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 15px;
        cursor: pointer;
        transition: all 0.3s ease;
      ">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
          <div>
            <h3 style="margin: 0 0 8px 0; color: #2d5016; font-size: 1.1em;">📋 ${escapeHtml(submission.id)}</h3>
            <div style="margin: 5px 0;">${statusBadge}</div>
          </div>
          <button class="view-submission-btn" data-submission-id="${submission.id}" style="
            background: linear-gradient(180deg, #4f9245, #467f3c);
            color: white;
            border: 1px solid #467f3c;
            padding: 10px 16px;
            border-radius: 12px;
            cursor: pointer;
            font-size: 0.9em;
            font-weight: 800;
            box-shadow: 0 10px 20px -16px rgba(70, 127, 60, 0.85);
          ">
            ${isSelected ? '✓ Viewing' : '<i class="fa fa-eye"></i> View Files'}
          </button>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 0.9em; color: #666;">
          <div>
            <strong>📅 Created:</strong><br/>${createdDate}
          </div>
          <div>
            <strong>✅ Submitted:</strong><br/>${submittedDate}
          </div>
          <div>
            <strong>📎 Files:</strong><br/>${submission.uploadCount} uploaded
          </div>
        </div>
        ${submission.appointmentCount > 0 ? `
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
            <h4 style="margin: 0 0 10px 0; color: #2d5016; font-size: 0.95em;">🗓️ Appointments (${submission.appointmentCount})</h4>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${submission.appointments.map(apt => {
                const aptStatus = apt.status || 'Pending';
                const statusLower = aptStatus.toLowerCase();
                
                // Determine status badge and color
                let statusBadge = '⏳';
                let statusColor = '#ff9800';
                
                if (statusLower === 'completed') {
                  statusBadge = '✅';
                  statusColor = '#4caf50';
                } else if (statusLower === 'scheduled') {
                  statusBadge = '📅';
                  statusColor = '#2196f3';
                } else if (statusLower === 'pending') {
                  statusBadge = '⏳';
                  statusColor = '#ff9800';
                }
                
                return `
                  <div style="background: #f9f9f9; padding: 8px 12px; border-radius: 4px; border-left: 3px solid ${statusColor};">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span style="font-weight: 500;">${statusBadge} ${apt.appointmentType || 'Tree Inventory'}</span>
                      <span style="font-size: 0.85em; color: white; background: ${statusColor}; padding: 2px 8px; border-radius: 3px;">${aptStatus}</span>
                    </div>
                    ${apt.foresterName ? `<div style="font-size: 0.85em; color: #666; margin-top: 4px;">👤 ${apt.foresterName}</div>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join("");
  
  console.log("✅ Cards HTML built, length:", cardsHtml.length);
  console.log("📝 Setting innerHTML...");
  
  listContainer.innerHTML = `
    <div style="background: #f0f8e8; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 2px solid #2d5016;">
      <h3 style="margin: 0 0 10px 0; color: #2d5016;">📁 Submissions (${availableSubmissions.length})</h3>
      <p style="margin: 0; font-size: 0.9em; color: #666;">Click on a submission to view its uploaded files</p>
    </div>
    <div id="submissionsCardsContainer">
      ${cardsHtml}
    </div>
  `;
  
  console.log("✅ innerHTML set, attaching event handlers...");
  
  // Attach click handlers to cards and buttons
  document.querySelectorAll(".submission-card").forEach((card) => {
    card.addEventListener("click", async (e) => {
      // Don't trigger if clicking the button
      if (e.target.classList.contains("view-submission-btn")) return;
      
      const submissionId = card.dataset.submissionId;
      await selectAndViewSubmission(userId, type, submissionId);
    });
  });
  
  document.querySelectorAll(".view-submission-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const submissionId = btn.dataset.submissionId;
      await selectAndViewSubmission(userId, type, submissionId);
    });
  });
  
  // Add hover effect
  const style = document.createElement('style');
  style.textContent = `
    .submission-card:hover {
      border-color: #2d5016 !important;
      box-shadow: 0 2px 8px rgba(45,80,22,0.2);
      transform: translateY(-2px);
    }
    .view-submission-btn:hover {
      background: linear-gradient(180deg, #467f3c, #3b6c33);
    }
  `;
  if (!document.getElementById('submission-card-styles')) {
    style.id = 'submission-card-styles';
    document.head.appendChild(style);
  }
  
  console.log("✅ displaySubmissionsList completed successfully");
}

// ------------------ SELECT AND VIEW SUBMISSION ------------------
async function selectAndViewSubmission(userId, type, submissionId) {
  currentSubmissionId = submissionId;
  console.log(`🔄 Viewing submission: ${currentSubmissionId}`);
  console.log(`📍 User: ${userId}, Type: ${type}`);
  
  // Update tree inventory module with current submission
  setCurrentApplication(type, submissionId);
  
  // Show the files table
  const filesTable = document.getElementById("filesTable");
  if (filesTable) filesTable.style.display = "table";
  
  // Load submission files
  await loadSubmissionFiles(userId, type, currentSubmissionId);
  
  // Update the submission cards to show selected state
  displaySubmissionsList(userId, type);
  
  console.log(`🎯 Showing buttons for type: ${type}`);
  console.log(`🔘 proceedBtn exists:`, !!proceedBtn);
  
  // Show appropriate buttons based on application type
  if (type === "ctpo" || type === "pltp" || type === "splt") {
    // CTPO, PLTP, SPLTP: Show tree tagging/inventory button
    if (proceedBtn) {
      proceedBtn.style.display = "block";
      console.log("✅ Set proceedBtn display to block");
    }
  } else {
    // Other types: hide proceed button
    if (proceedBtn) proceedBtn.style.display = "none";
  }
  
  // Show comment button and schedule button for all types when submission is selected
  if (commentBtn) commentBtn.style.display = "block";
  if (scheduleBtn) scheduleBtn.style.display = "block";
  
  console.log("📞 Calling updateProceedButtonState...");
  // Update button text based on appointment status
  await updateProceedButtonState(submissionId);
  console.log("✅ updateProceedButtonState completed");
  
  // Scroll to files table
  filesTable?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ------------------ CTPO REFERENCE MODAL FOR PLTP/SPLTP ------------------
async function showCtpoReferenceModal() {
  if (!currentOpenUserId) {
    alert("No applicant selected.");
    return;
  }

  try {
    // Fetch all CTPO submissions for this applicant
    console.log("🔍 Fetching CTPO submissions for applicant:", currentOpenUserId);
    console.log("🔍 Current application type:", currentApplicationType);
    const ctpoSubmissionsRef = collection(db, `applications/ctpo/applicants/${currentOpenUserId}/submissions`);
    const ctpoSnap = await getDocs(query(ctpoSubmissionsRef, orderBy("createdAt", "desc")));

    console.log(`📋 Found ${ctpoSnap.size} CTPO submission(s) for this applicant`);

    if (ctpoSnap.empty) {
      // No CTPO submissions for this specific applicant
      // Ask if admin wants to select from all CTPO submissions (any applicant)
      const useAnyApplicant = confirm(
        "⚠️ No CTPO submissions found for this applicant.\n\n" +
        "Would you like to select a CTPO reference from ANY applicant?\n\n" +
        "Click OK to see all completed CTPO submissions, or Cancel to go back."
      );
      
      if (!useAnyApplicant) {
        return;
      }
      
      // Fetch ALL CTPO submissions from all applicants
      console.log("🔍 Fetching ALL CTPO submissions from all applicants...");
      await showAllCtpoReferencesModal();
      return;
    }

    // Find CTPO submissions with completed tree tagging appointments
    const validCtpoSubmissions = [];
    
    // Query the appointments collection for completed CTPO tree tagging appointments
    console.log(`🔍 Checking appointments collection for applicant: ${currentOpenUserId}`);
    console.log(`🔍 Filtering for CTPO appointments...`);
    const appointmentsRef = collection(db, "appointments");
    const appointmentsQuery = query(
      appointmentsRef,
      where("applicantId", "==", currentOpenUserId),
      where("applicationType", "==", "ctpo"),
      where("status", "==", "Completed")
    );
    const appointmentsSnap = await getDocs(appointmentsQuery);
    
    console.log(`📋 Found ${appointmentsSnap.size} completed CTPO tree tagging appointment(s) for applicant`);
    
    if (appointmentsSnap.size === 0) {
      console.warn("⚠️ No completed CTPO appointments found for this applicant");
      alert("⚠️ No completed CTPO tree tagging appointments found.\n\nThe applicant must have at least one completed CTPO tree tagging appointment before assigning " + currentApplicationType.toUpperCase() + " tree tagging.");
      return;
    }

    // Build a set of submission IDs that have completed tree tagging
    const completedSubmissionIds = new Set();
    
    appointmentsSnap.forEach(aptDoc => {
      const aptData = aptDoc.data();
      console.log(`  ✅ Completed CTPO appointment: ${aptDoc.id}`, aptData);
      
      // Check if appointment has applicationID field (newer structure) or submissionId field (older structure)
      const linkedSubmissionId = aptData.applicationID || aptData.submissionId;
      if (linkedSubmissionId) {
        completedSubmissionIds.add(linkedSubmissionId);
        console.log(`    → Linked to submission: ${linkedSubmissionId}`);
      } else {
        console.warn(`    ⚠️ Appointment ${aptDoc.id} has no applicationID or submissionId field`);
      }
    });
    
    console.log(`📦 Completed submission IDs:`, Array.from(completedSubmissionIds));
    
    // Filter CTPO submissions that have completed tree tagging
    for (const ctpoDoc of ctpoSnap.docs) {
      const ctpoData = ctpoDoc.data();
      const ctpoId = ctpoDoc.id;
      
      // If we found submissions with completed appointments, filter by them
      // Otherwise, if applicant has completed appointments but no submissionId field,
      // assume all CTPO submissions are valid
      if (completedSubmissionIds.size > 0) {
        if (completedSubmissionIds.has(ctpoId)) {
          validCtpoSubmissions.push({
            id: ctpoId,
            data: ctpoData,
            createdAt: ctpoData.createdAt,
            submittedAt: ctpoData.submittedAt
          });
          console.log(`  ✓ Valid CTPO submission: ${ctpoId}`);
        }
      } else {
        // No submissionId in appointments, but applicant has completed tree tagging
        // So all their CTPO submissions are potentially valid
        validCtpoSubmissions.push({
          id: ctpoId,
          data: ctpoData,
          createdAt: ctpoData.createdAt,
          submittedAt: ctpoData.submittedAt
        });
        console.log(`  ✓ Valid CTPO submission (no submissionId filter): ${ctpoId}`);
      }
    }

    console.log(`✅ Found ${validCtpoSubmissions.length} CTPO submission(s) with completed tree tagging`);

    if (validCtpoSubmissions.length === 0) {
      alert("⚠️ No CTPO submissions with completed tree tagging found.\n\nThe applicant must have at least one CTPO submission with a completed tree tagging appointment before assigning " + currentApplicationType.toUpperCase() + " tree tagging.");
      return;
    }

    // Show modal with CTPO selection
    displayCtpoSelectionModal(validCtpoSubmissions);

  } catch (err) {
    console.error("❌ Error fetching CTPO submissions:", err);
    alert("Error loading CTPO submissions: " + err.message);
  }
}

function displayCtpoSelectionModal(ctpoSubmissions) {
  // Create modal if it doesn't exist
  let modal = document.getElementById("ctpoReferenceModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "ctpoReferenceModal";
    modal.className = "modal";
    modal.style.display = "none";
    document.body.appendChild(modal);
  }

  const submissionsHtml = ctpoSubmissions.map(submission => {
    const createdDate = submission.createdAt?.toDate 
      ? submission.createdAt.toDate().toLocaleString()
      : "N/A";
    const submittedDate = submission.submittedAt?.toDate 
      ? submission.submittedAt.toDate().toLocaleString()
      : "-";
    
    // Show applicant name if available (for cross-applicant references)
    const applicantInfo = submission.applicantName 
      ? `<div style="background: #f0f8e8; padding: 8px; border-radius: 4px; margin-bottom: 10px;">
           <strong>👤 Applicant:</strong> ${escapeHtml(submission.applicantName)}
         </div>`
      : '';
    
    return `
      <div class="ctpo-reference-card" data-ctpo-id="${submission.id}" style="
        background: white;
        border: 2px solid #ddd;
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 15px;
        cursor: pointer;
        transition: all 0.3s ease;
      ">
        <h3 style="margin: 0 0 10px 0; color: #2d5016; font-size: 1.1em;">📋 ${escapeHtml(submission.id)}</h3>
        ${applicantInfo}
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 0.9em; color: #666;">
          <div>
            <strong>📅 Created:</strong><br/>${createdDate}
          </div>
          <div>
            <strong>✅ Submitted:</strong><br/>${submittedDate}
          </div>
          <div>
            <strong>✓ Status:</strong><br/><span style="color: #4caf50;">Tree Tagging Completed</span>
          </div>
        </div>
        <button class="select-ctpo-btn" data-ctpo-id="${submission.id}" style="
          background: #2d5016;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9em;
          margin-top: 10px;
          width: 100%;
        ">
          ✓ Select This CTPO
        </button>
      </div>
    `;
  }).join("");

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px; max-height: 80vh; overflow-y: auto;">
      <span class="close" id="closeCtpoReferenceModal">&times;</span>
      <h2 style="color: #2d5016; margin-bottom: 20px;">📋 Select CTPO Reference</h2>
      <p style="color: #666; margin-bottom: 20px;">
        Select a CTPO submission with completed tree tagging to reference for this ${currentApplicationType.toUpperCase()} tree tagging assignment:
      </p>
      <div id="ctpoReferenceList">
        ${submissionsHtml}
      </div>
    </div>
  `;

  showModal(modal);

  // Close button handler
  const closeBtn = document.getElementById("closeCtpoReferenceModal");
  closeBtn.onclick = () => {
    modal.style.display = "none";
  };

  // Click outside to close
  modal.onclick = (event) => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  };

  // Add hover effects
  const style = document.createElement('style');
  style.textContent = `
    .ctpo-reference-card:hover {
      border-color: #2d5016 !important;
      box-shadow: 0 4px 12px rgba(45,80,22,0.3);
      transform: translateY(-2px);
    }
    .select-ctpo-btn:hover {
      background: #1a4d0a;
    }
  `;
  if (!document.getElementById('ctpo-reference-modal-styles')) {
    style.id = 'ctpo-reference-modal-styles';
    document.head.appendChild(style);
  }

  // Attach selection handlers
  document.querySelectorAll(".select-ctpo-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const ctpoId = btn.dataset.ctpoId;
      selectCtpoReference(ctpoId);
      modal.style.display = "none";
    });
  });

  document.querySelectorAll(".ctpo-reference-card").forEach(card => {
    card.addEventListener("click", (e) => {
      if (!e.target.classList.contains("select-ctpo-btn")) {
        const ctpoId = card.dataset.ctpoId;
        selectCtpoReference(ctpoId);
        modal.style.display = "none";
      }
    });
  });
}

// Show ALL CTPO references from all applicants
async function showAllCtpoReferencesModal() {
  try {
    console.log("🔍 Fetching ALL completed CTPO appointments...");
    
    // Query all completed CTPO tree tagging appointments
    const appointmentsRef = collection(db, "appointments");
    const appointmentsQuery = query(
      appointmentsRef,
      where("applicationType", "==", "ctpo"),
      where("appointmentType", "==", "Tree Tagging"),
      where("status", "==", "Completed")
    );
    const appointmentsSnap = await getDocs(appointmentsQuery);
    
    console.log(`📋 Found ${appointmentsSnap.size} completed CTPO tree tagging appointment(s) across all applicants`);
    
    if (appointmentsSnap.size === 0) {
      alert("⚠️ No completed CTPO tree tagging appointments found in the system.");
      return;
    }

    // Build list of valid CTPO submissions with applicant info
    const validCtpoSubmissions = [];
    
    for (const aptDoc of appointmentsSnap.docs) {
      const aptData = aptDoc.data();
      const linkedSubmissionId = aptData.applicationID || aptData.submissionId;
      const applicantId = aptData.applicantId;
      const applicantName = aptData.applicantName || "Unknown Applicant";
      
      if (linkedSubmissionId && applicantId) {
        // Check if this submission exists
        try {
          const submissionRef = doc(db, "applications", "ctpo", "applicants", applicantId, "submissions", linkedSubmissionId);
          const submissionSnap = await getDoc(submissionRef);
          
          if (submissionSnap.exists()) {
            const submissionData = submissionSnap.data();
            validCtpoSubmissions.push({
              id: linkedSubmissionId,
              data: submissionData,
              createdAt: submissionData.createdAt,
              submittedAt: submissionData.submittedAt,
              applicantId: applicantId,
              applicantName: applicantName
            });
            console.log(`  ✓ Valid CTPO submission: ${linkedSubmissionId} (Applicant: ${applicantName})`);
          }
        } catch (err) {
          console.warn(`  ⚠️ Error fetching submission ${linkedSubmissionId}:`, err);
        }
      }
    }

    console.log(`✅ Found ${validCtpoSubmissions.length} valid CTPO submission(s) with completed tree tagging`);

    if (validCtpoSubmissions.length === 0) {
      alert("⚠️ No valid CTPO submissions with completed tree tagging found.");
      return;
    }

    // Show modal with CTPO selection
    displayCtpoSelectionModal(validCtpoSubmissions);

  } catch (err) {
    console.error("❌ Error fetching all CTPO references:", err);
    alert("Error loading CTPO references: " + err.message);
  }
}

async function selectCtpoReference(ctpoId) {
  console.log("✓ Selected CTPO reference:", ctpoId);
  
  // Store the CTPO reference in the current submission
  try {
    const submissionRef = doc(
      db,
      "applications",
      currentApplicationType,
      "applicants",
      currentOpenUserId,
      "submissions",
      currentSubmissionId
    );
    
    await updateDoc(submissionRef, {
      ctpoReference: ctpoId,
      ctpoReferenceUpdatedAt: serverTimestamp()
    });
    
    console.log("✅ CTPO reference saved to submission");
    
    // Now proceed with tree tagging assignment, passing CTPO reference
    setAppointmentMode('new', null, null, ctpoId);
    
  } catch (err) {
    console.error("❌ Error saving CTPO reference:", err);
    alert("Error saving CTPO reference: " + err.message);
  }
}

// ------------------ UPDATE PROCEED BUTTON STATE ------------------
async function updateProceedButtonState(submissionId) {
  if (!proceedBtn) return;
  
  // Only handle CTPO, PLTP, and SPLTP
  if (currentApplicationType !== "ctpo" && currentApplicationType !== "pltp" && currentApplicationType !== "splt") return;
  
  try {
    // Find the submission in availableSubmissions
    const submission = availableSubmissions.find(s => s.id === submissionId);
    
    console.log("🔍 updateProceedButtonState called for:", submissionId);
    console.log("📦 Found submission:", submission);
    console.log("📋 Appointments:", submission?.appointments);
    
    if (!submission || !submission.appointments || submission.appointments.length === 0) {
      // No appointments
      if (currentApplicationType === "ctpo") {
        // CTPO: show "Assign for Tree Tagging"
        proceedBtn.textContent = "Assign for Tree Tagging";
        proceedBtn.disabled = false;
        proceedBtn.style.display = "block";
        
        proceedBtn.onclick = () => {
          setAppointmentMode('new', null, null);
        };
        console.log("✅ Button set to: Assign for Tree Tagging (CTPO)");
      } else if (currentApplicationType === "pltp" || currentApplicationType === "splt") {
        // PLTP/SPLTP: show "Select CTPO Reference"
        proceedBtn.textContent = "Select CTPO Reference";
        proceedBtn.disabled = false;
        proceedBtn.style.display = "block";
        
        proceedBtn.onclick = async () => {
          await showCtpoReferenceModal();
        };
        console.log("✅ Button set to: Select CTPO Reference (PLTP/SPLTP)");
      }
      
      // Hide claim certificate button (no completed tree tagging)
      if (claimCertificateBtn) claimCertificateBtn.style.display = "none";
      return;
    }
    
    // Check if there's a completed tree tagging appointment
    const hasCompletedTreeTagging = submission.appointments.some(
      apt => apt.appointmentType === 'Tree Tagging' && apt.status && apt.status.toLowerCase() === 'completed'
    );
    
    // Check if there's a revisit appointment (pending or scheduled)
    const revisitAppointment = submission.appointments.find(
      apt => apt.appointmentType === 'Revisit' && apt.status && 
      (apt.status.toLowerCase() === 'pending' || apt.status.toLowerCase() === 'scheduled')
    );
    
    // Check if there's a pending/scheduled tree tagging appointment
    const pendingTreeTagging = submission.appointments.find(
      apt => apt.appointmentType === 'Tree Tagging' && apt.status && 
      (apt.status.toLowerCase() === 'pending' || apt.status.toLowerCase() === 'scheduled')
    );
    
    // Show/hide claim certificate button based on completed tree tagging (CTPO only)
    if (claimCertificateBtn) {
      claimCertificateBtn.style.display = (currentApplicationType === "ctpo" && hasCompletedTreeTagging) ? "block" : "none";
    }
    
    // Handle CTPO with revisit functionality
    if (currentApplicationType === "ctpo") {
      if (revisitAppointment) {
        // Has revisit appointment - show "Modify Revisit Assignment"
        proceedBtn.textContent = "Modify Revisit Assignment";
        proceedBtn.disabled = false;
        proceedBtn.style.display = "block";
        
        // Set mode to 'modify' for revisit appointment
        proceedBtn.onclick = () => {
          setAppointmentMode('modify', revisitAppointment.id, revisitAppointment);
        };
        console.log("✅ Button set to: Modify Revisit Assignment");
      } else if (pendingTreeTagging) {
        // Has pending/scheduled tree tagging - show "Modify Tree Tagging Assignment"
        proceedBtn.textContent = "Modify Tree Tagging Assignment";
        proceedBtn.disabled = false;
        proceedBtn.style.display = "block";
        
        // Set mode to 'modify' with existing appointment data
        proceedBtn.onclick = () => {
          setAppointmentMode('modify', pendingTreeTagging.id, pendingTreeTagging);
        };
        console.log("✅ Button set to: Modify Tree Tagging Assignment");
      } else if (hasCompletedTreeTagging) {
        // Has completed tree tagging but no revisit - show "Assign for Revisit"
        proceedBtn.textContent = "Assign for Revisit";
        proceedBtn.disabled = false;
        proceedBtn.style.display = "block";
        
        // Set mode to 'revisit' when button will be clicked
        proceedBtn.onclick = () => {
          setAppointmentMode('revisit', null, null);
        };
        console.log("✅ Button set to: Assign for Revisit");
      } else {
        // Default fallback
        proceedBtn.textContent = "Assign for Tree Tagging";
        proceedBtn.disabled = false;
        proceedBtn.style.display = "block";
        proceedBtn.onclick = () => {
          setAppointmentMode('new', null, null);
        };
        console.log("✅ Button set to: Assign for Tree Tagging (fallback)");
      }
    } else if (currentApplicationType === "pltp" || currentApplicationType === "splt") {
      // Handle PLTP/SPLTP without revisit functionality
      if (pendingTreeTagging) {
        // Has pending/scheduled tree tagging - show "Modify Tree Tagging Assignment"
        proceedBtn.textContent = "Modify Tree Tagging Assignment";
        proceedBtn.disabled = false;
        proceedBtn.style.display = "block";
        
        // Set mode to 'modify' with existing appointment data
        proceedBtn.onclick = () => {
          setAppointmentMode('modify', pendingTreeTagging.id, pendingTreeTagging);
        };
        console.log("✅ Button set to: Modify Tree Tagging Assignment (PLTP/SPLTP)");
      } else if (hasCompletedTreeTagging) {
        // Tree tagging completed - hide button (no revisit for PLTP/SPLTP)
        proceedBtn.style.display = "none";
        console.log("✅ Button hidden (Tree Tagging completed, no revisit)");
      } else {
        // No appointments - show "Select CTPO Reference"
        proceedBtn.textContent = "Select CTPO Reference";
        proceedBtn.disabled = false;
        proceedBtn.style.display = "block";
        proceedBtn.onclick = async () => {
          await showCtpoReferenceModal();
        };
        console.log("✅ Button set to: Select CTPO Reference (PLTP/SPLTP)");
      }
    }
  } catch (err) {
    console.error("Error updating proceed button state:", err);
    proceedBtn.textContent = "Assign for Tree Tagging";
    proceedBtn.disabled = false;
    proceedBtn.onclick = () => {
      setAppointmentMode('new', null, null);
    };
    // Hide claim certificate button on error
    if (claimCertificateBtn) claimCertificateBtn.style.display = "none";
  }
}

// ------------------ LOAD SUBMISSION FILES ------------------
async function loadSubmissionFiles(userId, type, submissionId) {
  try {
    filesBody.innerHTML = `<tr><td colspan="4" style="text-align:center;"><span class="spinner"></span> Loading files...</td></tr>`;
    
    console.log(
      "🔍 Fetching submission document:",
      `applications/${type}/applicants/${userId}/submissions/${submissionId}`
    );
    
    filesBody.innerHTML = "";
    
    // Fetch the submission document to get the uploads map (for reuploadAllowed flags)
    const submissionRef = doc(db, `applications/${type}/applicants/${userId}/submissions/${submissionId}`);
    const submissionSnap = await getDoc(submissionRef);
    
    if (!submissionSnap.exists()) {
      console.warn("⚠️ Submission document not found");
      const noFilesRow = document.createElement("tr");
      noFilesRow.innerHTML = "<td colspan='4' style='text-align:center; color:#888;'>Submission not found.</td>";
      filesBody.appendChild(noFilesRow);
      return;
    }

    const submissionData = submissionSnap.data();
    const uploadsMapMetadata = submissionData.uploads || {}; // For reuploadAllowed flags
    
    // Fetch the uploads SUBCOLLECTION for full upload data (URLs, filenames, etc.)
    const uploadsCollectionRef = collection(db, `applications/${type}/applicants/${userId}/submissions/${submissionId}/uploads`);
    const uploadsSnap = await getDocs(uploadsCollectionRef);
    
    if (uploadsSnap.empty) {
      console.warn("⚠️ No uploads found in this submission");
      const noFilesRow = document.createElement("tr");
      noFilesRow.innerHTML = "<td colspan='4' style='text-align:center; color:#888;'>No files have been uploaded in this submission yet.</td>";
      filesBody.appendChild(noFilesRow);
      return;
    }

    console.log(`📤 Found ${uploadsSnap.size} upload(s) in submission`);

    // Display each uploaded file as a table row
    for (const uploadDoc of uploadsSnap.docs) {
      const docId = uploadDoc.id;
      const docData = uploadDoc.data();
      
      console.log(`📄 Upload "${docId}":`, docData);
      
      const title = docData.title || docId;
      const fileName = docData.fileName || "Unknown";
      const url = docData.url || docData.URL || "";
      
      // Skip if no URL (placeholder)
      if (!url || url.trim() === "") {
        console.log(`⏭️ Skipping "${docId}" - no URL`);
        continue;
      }
      
      // Handle both Firestore Timestamp and string dates
      let uploadedAt = "-";
      if (docData.uploadedAt?.toDate) {
        uploadedAt = docData.uploadedAt.toDate().toLocaleString();
      } else if (typeof docData.uploadedAt === "string" && docData.uploadedAt.trim()) {
        uploadedAt = docData.uploadedAt;
      }

      // Get reuploadAllowed from the uploads MAP in the submission document
      const reuploadAllowed = uploadsMapMetadata[docId]?.reuploadAllowed || false;
      
      // Check if there are comments in the uploads subcollection
      const commentsRef = collection(db, `applications/${type}/applicants/${userId}/submissions/${submissionId}/uploads/${docId}/comments`);
      const commentsSnap = await getDocs(commentsRef);
      const hasComment = !commentsSnap.empty;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(title)} ${hasComment ? '💬' : ''} ${reuploadAllowed ? '🔄' : ''}</td>
        <td>${escapeHtml(fileName)}</td>
        <td>${escapeHtml(uploadedAt)}</td>
        <td>
          <button class="action-btn view-btn" data-url="${escapeHtml(url)}" data-docid="${escapeHtml(docId)}" data-title="${escapeHtml(title)}">View</button>
        </td>
      `;

      // View button handler
      tr.querySelector(".view-btn").addEventListener("click", async () => {
        const btn = tr.querySelector(".view-btn");
        const fileUrl = btn.dataset.url;
        const docTitle = btn.dataset.title || "Document";

        if (!fileUrl || fileUrl === "#" || fileUrl.trim() === "") {
          alert("No file URL available for this document.");
          return;
        }

        const modal = document.getElementById("filePreviewModal");
        const iframe = document.getElementById("previewFrame");
        const titleEl = document.getElementById("previewTitle");
        const downloadBtn = document.getElementById("downloadFileBtn");

        if (!modal || !iframe || !titleEl) {
          window.open(fileUrl, "_blank");
          return;
        }

        titleEl.textContent = `File Preview - ${docTitle}`;
        
        // Hide download button to prevent downloads
        if (downloadBtn) {
          downloadBtn.style.display = "none";
        }

        const fileExt = fileUrl.split("?")[0].split(".").pop()?.toLowerCase();
        const isImage = ["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"].includes(fileExt);
        const isPdf = fileExt === "pdf";
        let viewerUrl = fileUrl;

        if (isImage) {
          // Images can be displayed directly
          viewerUrl = fileUrl;
        } else if (isPdf) {
          // Use Google Docs Viewer for PDFs to avoid download
          const encodedUrl = encodeURIComponent(fileUrl);
          viewerUrl = `https://docs.google.com/gview?url=${encodedUrl}&embedded=true`;
        } else {
          // Use Google Docs Viewer for all other document types
          const encodedUrl = encodeURIComponent(fileUrl);
          viewerUrl = `https://docs.google.com/gview?url=${encodedUrl}&embedded=true`;
        }

        iframe.src = viewerUrl;
        modal.style.display = "flex";
      });

      filesBody.appendChild(tr);
    }

  } catch (err) {
    console.error("❌ Error loading submission files:", err);
    filesBody.innerHTML =
      "<tr><td colspan='4' style='color:red;text-align:center'>Error loading files: " + err.message + "</td></tr>";
  }
}

// Set up file preview modal close handlers (only once)
const filePreviewModal = document.getElementById("filePreviewModal");
const closeFilePreview = document.getElementById("closeFilePreview");

if (closeFilePreview && !closeFilePreview.dataset.listenerAttached) {
  const closePreviewModal = () => {
    filePreviewModal.style.display = "none";
    const iframe = document.getElementById("previewFrame");
    if (iframe) iframe.src = "";
    const downloadBtn = document.getElementById("downloadFileBtn");
    if (downloadBtn) downloadBtn.href = "#";
  };

  closeFilePreview.addEventListener("click", closePreviewModal);
  closeFilePreview.dataset.listenerAttached = "true";

  window.addEventListener("click", (e) => {
    if (e.target === filePreviewModal) {
      filePreviewModal.style.display = "none";
      const iframe = document.getElementById("previewFrame");
      if (iframe) iframe.src = "";
      const downloadBtn = document.getElementById("downloadFileBtn");
      if (downloadBtn) downloadBtn.href = "#";
    }
  });
}

// ------------------ APPLICATION TYPE BUTTONS (wait for sidebar) ------------------

// Function to attach listeners once sidebar is loaded
function attachSidebarListeners() {
  const ctpoBtn = document.getElementById("ctpoBtn");
  const pltpBtn = document.getElementById("pltpBtn");
  const spltpBtn = document.getElementById("spltpBtn");
  const covBtn = document.getElementById("covBtn");
  const chainsawBtn = document.getElementById("chainsawBtn");

  function handleAppButtonClick(type, title) {
    applicationTypeTitle.textContent = title;
    loadApplicants(type);
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
    handleAppButtonClick("splt", "SPLT Applications");
  });
  covBtn?.addEventListener("click", () => {
    console.log("COV button clicked");
    handleAppButtonClick("cov", "Certificate of Verification Applications");
  });
  chainsawBtn?.addEventListener("click", () => {
    console.log("Chainsaw button clicked");
    handleAppButtonClick("chainsaw", "Chainsaw Registration Applications");
  });

  console.log("✅ Sidebar event listeners attached successfully!");
  console.log("Found buttons:", { ctpoBtn, pltpBtn, spltpBtn, covBtn, chainsawBtn });
}

// Wait for sidebar to be loaded dynamically in applications.html
document.addEventListener("sidebarLoaded", attachSidebarListeners);

// Expose for direct calls from pages that load the sidebar dynamically
window.attachSidebarListeners = attachSidebarListeners;
// Expose loadApplicants so it can be called from navigation
window.loadApplicants = loadApplicants;

// ------------------ INITIAL PAGE LOAD ------------------
window.addEventListener("DOMContentLoaded", async () => {
  await loadApplicationStats(); // load summary stats first
});

// ------------------ COMMENT MODAL ------------------
function initCommentModal() {
  commentBtn = document.getElementById("commentBtn");
  commentModal = document.getElementById("commentModal");
  closeCommentModal = document.getElementById("closeCommentModal");
  sendCommentBtn = document.getElementById("sendCommentBtn");
  commentDocumentSelect = document.getElementById("commentDocumentSelect");

  if (!commentBtn || !commentModal) return; // Elements not ready yet

commentBtn.addEventListener("click", async () => {
  if (!currentOpenUserId) {
    alert("Please select an applicant first before commenting.");
    return;
  }

  showModal(commentModal);

  if (commentDocumentSelect) {
    commentDocumentSelect.innerHTML = "";
    const loadingOpt = document.createElement("option");
    loadingOpt.textContent = "Loading documents...";
    loadingOpt.disabled = true;
    commentDocumentSelect.appendChild(loadingOpt);
  }

  // Populate the document dropdown asynchronously so modal opens instantly
  populateCommentDocuments();
});

// Populate document dropdown in comment modal
async function populateCommentDocuments() {
  if (sendCommentBtn) sendCommentBtn.disabled = true;
  commentDocumentSelect.innerHTML = "";

  try {
    if (!currentSubmissionId) {
      console.warn("⚠️ No submission selected");
      const opt = document.createElement("option");
      opt.textContent = "No submission selected";
      opt.disabled = true;
      commentDocumentSelect.appendChild(opt);
      return;
    }

    // Fetch uploads from the SUBCOLLECTION (contains full upload data)
    console.log(
      "🔍 Fetching documents for comments from:",
      `applications/${currentApplicationType}/applicants/${currentOpenUserId}/submissions/${currentSubmissionId}/uploads`
    );
    
    const uploadsCollectionRef = collection(db, `applications/${currentApplicationType}/applicants/${currentOpenUserId}/submissions/${currentSubmissionId}/uploads`);
    const uploadsSnap = await getDocs(uploadsCollectionRef);
    
    if (uploadsSnap.empty) {
      console.warn("⚠️ No uploads found in submission");
      const opt = document.createElement("option");
      opt.textContent = "No documents uploaded";
      opt.disabled = true;
      commentDocumentSelect.appendChild(opt);
      return;
    }

    console.log(`📄 Found ${uploadsSnap.size} upload(s) for comments`);

    // Filter out uploads without URLs (placeholders)
    let hasValidUploads = false;
    
    uploadsSnap.forEach((uploadDoc) => {
      const docId = uploadDoc.id;
      const docData = uploadDoc.data();
      const url = docData.url || docData.URL || "";
      
      // Skip placeholders without URLs
      if (!url || url.trim() === "") {
        console.log(`⏭️ Skipping "${docId}" for comments - no URL`);
        return;
      }
      
      hasValidUploads = true;
      const fileName = docData.fileName || "Unknown";
      const title = docData.title || docId;

      const opt = document.createElement("option");
      opt.value = docId; // Use the document ID as value
      opt.textContent = `${title} - ${fileName}`;
      commentDocumentSelect.appendChild(opt);
    });

    if (!hasValidUploads) {
      console.warn("⚠️ No valid uploaded documents found");
      commentDocumentSelect.innerHTML = "";
      const opt = document.createElement("option");
      opt.textContent = "No documents uploaded";
      opt.disabled = true;
      commentDocumentSelect.appendChild(opt);
    }
  } catch (err) {
    console.error("Error loading documents for comment:", err);
    const opt = document.createElement("option");
    opt.textContent = "Error loading documents";
    opt.disabled = true;
    commentDocumentSelect.appendChild(opt);
  } finally {
    if (sendCommentBtn) sendCommentBtn.disabled = false;
  }
}

closeCommentModal.addEventListener("click", () => {
  commentModal.style.display = "none";
});

sendCommentBtn.addEventListener("click", async () => {
  const message = document.getElementById("commentMessage").value.trim();
  const selectedDocs = Array.from(commentDocumentSelect.selectedOptions).map(
    (opt) => opt.value
  );

  if (!message) {
    alert("Please enter your comment before sending.");
    return;
  }

  if (selectedDocs.length === 0) {
    alert("⚠️ Please select at least one document to comment on.");
    return;
  }

  if (!currentOpenUserId || !currentApplicationType) {
    alert("⚠️ No applicant or application type selected.");
    return;
  }

  try {
    // Get admin identity for attribution
    const auth = getAuth();
    const adminEmail = auth.currentUser?.email || "Admin";

    console.log(
      `💬 Saving comments for ${currentApplicationType.toUpperCase()} submission ${currentSubmissionId}`
    );

    if (!currentSubmissionId) {
      alert("⚠️ No submission selected.");
      return;
    }

    // Get the submission document reference
    const submissionRef = doc(
      db,
      "applications",
      currentApplicationType,
      "applicants",
      currentOpenUserId,
      "submissions",
      currentSubmissionId
    );

    // For each selected document, save comment and update reupload flag
    for (const docId of selectedDocs) {
      // Update the reuploadAllowed flag in the uploads map
      const updatePath = `uploads.${docId}.reuploadAllowed`;
      const lastCommentPath = `uploads.${docId}.lastCommentAt`;
      
      await setDoc(
        submissionRef,
        {
          [updatePath]: true,
          [lastCommentPath]: serverTimestamp(),
        },
        { merge: true }
      );

      // Add comment to the uploads/{docId}/comments subcollection
      const commentsRef = collection(
        db,
        "applications",
        currentApplicationType,
        "applicants",
        currentOpenUserId,
        "submissions",
        currentSubmissionId,
        "uploads",
        docId,
        "comments"
      );

      await addDoc(commentsRef, {
        comment: message,
        commenterId: auth.currentUser?.uid || "admin",
        from: adminEmail,
        commentedAt: serverTimestamp(),
      });

      console.log(
        `✅ Comment saved to ${currentApplicationType}/applicants/${currentOpenUserId}/submissions/${currentSubmissionId}/uploads/${docId}/comments`
      );
    }

    const docCount = selectedDocs.length;
    alert(
      `✅ Comment sent to ${docCount} document${
        docCount > 1 ? "s" : ""
      } in submission ${currentSubmissionId}!\n\nThe applicant can now re-upload the selected document${
        docCount > 1 ? "s" : ""
      }.`
    );

    document.getElementById("commentMessage").value = "";
    commentDocumentSelect.selectedIndex = -1;
    commentModal.style.display = "none";

    // Refresh the submission files to show updated state
    await loadSubmissionFiles(
      currentOpenUserId,
      currentApplicationType,
      currentSubmissionId
    );
  } catch (err) {
    console.error("❌ Error sending comment:", err);
    alert("Failed to send comment: " + err.message);
  }
});

closeCommentModal.addEventListener("click", () => {
  commentModal.style.display = "none";
});
}

// ==================== CLAIM CERTIFICATE MODAL ====================
function initClaimCertificateModal() {
  claimCertificateBtn = document.getElementById("claimCertificateBtn");
  claimCertificateModal = document.getElementById("claimCertificateModal");
  closeClaimCertificateModal = document.getElementById("closeClaimCertificateModal");
  sendClaimNotificationBtn = document.getElementById("sendClaimNotificationBtn");
  claimApplicantName = document.getElementById("claimApplicantName");
  claimCertificateType = document.getElementById("claimCertificateType");
  claimMessage = document.getElementById("claimMessage");
  claimRemarks = document.getElementById("claimRemarks");

  if (!claimCertificateModal) return; // Elements not ready yet

  // Close modal
  if (closeClaimCertificateModal) {
    closeClaimCertificateModal.addEventListener("click", () => {
      claimCertificateModal.style.display = "none";
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === claimCertificateModal)
      claimCertificateModal.style.display = "none";
  });

  // Open claim certificate modal
  if (claimCertificateBtn) {
    claimCertificateBtn.addEventListener("click", async () => {
      if (!currentOpenUserId) return alert("⚠️ Select an applicant first.");
      if (!currentApplicationType) return alert("⚠️ No application type selected.");

      // Get applicant info
      claimApplicantName.value = currentApplicantData?.applicantName || 
                                  currentApplicantData?.name || 
                                  "Unnamed Applicant";

      // Set certificate type based on application type
      const certificateTypeMap = {
        ctpo: "Certificate of Tree Plantation Ownership (CTPO)",
        pltp: "Private Land Timber Permit (PLTP)",
        splt: "Special Land Timber Permit (SPLTP)",
        ptc: "Permit to Cut",
        ctt: "Certificate to Travel (CTT)",
        chainsaw: "Chainsaw Registration Certificate",
      };
      
      claimCertificateType.textContent =
        certificateTypeMap[currentApplicationType] ||
        currentApplicationType.toUpperCase() + " Certificate";

      // Reset form
      claimMessage.value = "Your certificate is now ready for pickup at the DENR Municipal Office in Aparri. Please bring a valid ID and your application reference number.";
      claimRemarks.value = "";

      showModal(claimCertificateModal);
    });
  }

  // Send claim notification
  if (sendClaimNotificationBtn) {
    sendClaimNotificationBtn.addEventListener("click", async () => {
      const message = claimMessage.value.trim();
      const remarks = claimRemarks.value.trim();

      if (!message) {
        alert("⚠️ Please enter a message for the applicant.");
        return;
      }

      if (!currentOpenUserId || !currentApplicationType) {
        alert("⚠️ No applicant or application type selected.");
        return;
      }

      try {
        // Get admin identity
        const auth = getAuth();
        const adminEmail = auth.currentUser?.email || "Admin";

        console.log(
          `📜 Sending claim notification for ${currentApplicationType.toUpperCase()} certificate`
        );

        // Create notification with certificateType as document ID
        const notificationId = `${currentApplicationType}_${currentOpenUserId}`;
        
        await setDoc(doc(db, "notifications", notificationId), {
          recipientId: currentOpenUserId,
          recipientName: claimApplicantName.value,
          applicationType: currentApplicationType,
          certificateType: claimCertificateType.textContent,
          notificationType: "certificate_ready",
          title: "Certificate Ready for Claim",
          message: message,
          remarks: remarks || "",
          sentBy: adminEmail,
          status: "unread",
          createdAt: serverTimestamp(),
        });

        // Update the applicant's document to mark certificate as ready
        const applicantRef = doc(
          db,
          "applications",
          currentApplicationType,
          "applicants",
          currentOpenUserId
        );

        await setDoc(
          applicantRef,
          {
            certificateStatus: "ready_for_claim",
            certificateReadyAt: serverTimestamp(),
            notifiedBy: adminEmail,
          },
          { merge: true }
        );

        console.log(
          `✅ Claim notification sent to applicant ${currentOpenUserId}`
        );

        alert(
          `✅ Certificate claim notification sent successfully!\n\nApplicant: ${claimApplicantName.value}\nCertificate: ${claimCertificateType.textContent}`
        );

        claimCertificateModal.style.display = "none";

        // Reset form
        claimMessage.value = "Your certificate is now ready for pickup at the DENR Municipal Office in Aparri. Please bring a valid ID and your application reference number.";
        claimRemarks.value = "";
      } catch (err) {
        console.error("❌ Error sending claim notification:", err);
        alert("Failed to send notification: " + err.message);
      }
    });
  }
}

// ==================== TEMPLATE UPLOAD MODAL ====================
function initTemplateModal() {
  manageTemplatesBtn = document.getElementById("manageTemplatesBtn");
  templateModal = document.getElementById("templateModal");
  closeTemplateModal = document.getElementById("closeTemplateModal");
  uploadTemplateFileBtn = document.getElementById("uploadTemplateFileBtn");
  templateFileInput = document.getElementById("templateFileInput");
  templateDocumentType = document.getElementById("templateDocumentType");
  templateTitle = document.getElementById("templateTitle");
  templateDescription = document.getElementById("templateDescription");
  existingTemplatesList = document.getElementById("existingTemplatesList");

  if (!templateModal) return; // Elements not ready yet

  // Close modal
  if (closeTemplateModal) {
    closeTemplateModal.addEventListener("click", () => {
      templateModal.style.display = "none";
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === templateModal)
      templateModal.style.display = "none";
  });

  // Open manage templates modal
  if (manageTemplatesBtn) {
    manageTemplatesBtn.addEventListener("click", async () => {
      if (!currentApplicationType) return alert("⚠️ No application type selected.");

      // Load existing templates
      await loadExistingTemplates(currentApplicationType);

      // Reset upload form
      templateDocumentType.value = "";
      templateTitle.value = "";
      templateDescription.value = "";
      templateFileInput.value = "";

      showModal(templateModal);
    });
  }

  // Upload template file
  if (uploadTemplateFileBtn) {
    uploadTemplateFileBtn.addEventListener("click", async () => {
      const documentType = templateDocumentType.value.trim();
      const title = templateTitle.value.trim();
      const description = templateDescription.value.trim();
      const file = templateFileInput.files[0];

      if (!documentType) {
        alert("⚠️ Please enter a document type/label.");
        return;
      }

      if (!file) {
        alert("⚠️ Please select a template file to upload.");
        return;
      }

      if (!title) {
        alert("⚠️ Please enter a title for the template.");
        return;
      }

      try {
        // Import Firebase Storage functions
        const { getStorage, ref: storageRef, uploadBytes, getDownloadURL } = await import(
          "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js"
        );

        const storage = getStorage();
        
        // Create a reference for the template file
        const templatePath = `applications/${currentApplicationType}/templates/${documentType}/${file.name}`;
        const fileRef = storageRef(storage, templatePath);

        console.log(`📤 Uploading template to: ${templatePath}`);

        // Upload the file
        const uploadResult = await uploadBytes(fileRef, file);
        const downloadURL = await getDownloadURL(uploadResult.ref);

        console.log(`✅ Template uploaded successfully: ${downloadURL}`);

        // Save template metadata to Firestore
        // Use documentType as the document ID for easy management
        const templateDocRef = doc(
          db,
          "applications",
          currentApplicationType,
          "templates",
          documentType
        );

        await setDoc(templateDocRef, {
          documentType: documentType,
          title: title,
          description: description,
          fileName: file.name,
          url: downloadURL,
          uploadedAt: serverTimestamp(),
          uploadedBy: getAuth().currentUser?.email || "Admin",
        });

        console.log(`✅ Template metadata saved to Firestore`);

        alert(
          `✅ Template uploaded successfully!\n\nDocument Type: ${documentType}\nFile: ${file.name}\n\nAll applicants can now download this template.`
        );

        // Reload existing templates
        await loadExistingTemplates(currentApplicationType);

        // Reset form
        templateDocumentType.value = "";
        templateTitle.value = "";
        templateDescription.value = "";
        templateFileInput.value = "";
      } catch (err) {
        console.error("❌ Error uploading template:", err);
        alert("Failed to upload template: " + err.message);
      }
    });
  }
}

// Load and display existing templates for the current application type
async function loadExistingTemplates(appType) {
  existingTemplatesList.innerHTML = "<p style='text-align:center; color:#888;'>Loading templates...</p>";

  try {
    const templatesRef = collection(db, "applications", appType, "templates");
    const templatesSnap = await getDocs(templatesRef);

    if (templatesSnap.empty) {
      existingTemplatesList.innerHTML = `
        <p style='text-align:center; color:#888; padding:20px;'>
          No templates uploaded yet for ${appType.toUpperCase()} applications.
        </p>
      `;
      return;
    }

    existingTemplatesList.innerHTML = "";

    for (const templateDoc of templatesSnap.docs) {
      const templateData = templateDoc.data();
      const templateId = templateDoc.id;

      const documentType = templateData.documentType || templateId;
      const title = templateData.title || "Template";
      const description = templateData.description || "";
      const fileName = templateData.fileName || "Unknown";
      const url = templateData.url || "";
      const uploadedBy = templateData.uploadedBy || "Unknown";
      
      let uploadedAt = "Unknown";
      if (templateData.uploadedAt?.toDate) {
        uploadedAt = templateData.uploadedAt.toDate().toLocaleString();
      }

      const templateCard = document.createElement("div");
      templateCard.style.cssText = "border:1px solid #ddd; padding:15px; margin:10px 0; border-radius:5px; background:#f9f9f9;";
      templateCard.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:start;">
          <div style="flex:1;">
            <h4 style="margin:0 0 5px 0; color:#2d5016;">📄 ${escapeHtml(documentType)}</h4>
            <p style="margin:5px 0; font-weight:bold;">${escapeHtml(title)}</p>
            ${description ? `<p style="margin:5px 0; color:#666; font-size:0.9em;">${escapeHtml(description)}</p>` : ''}
            <p style="margin:5px 0; font-size:0.85em; color:#888;">
              File: ${escapeHtml(fileName)}<br/>
              Uploaded: ${escapeHtml(uploadedAt)}<br/>
              By: ${escapeHtml(uploadedBy)}
            </p>
          </div>
          <div style="display:flex; gap:10px; flex-direction:column;">
            <button class="action-btn-secondary view-template-btn" data-url="${escapeHtml(url)}" style="white-space:nowrap;">
              👁️ View
            </button>
            <button class="action-btn-secondary delete-template-btn" data-id="${escapeHtml(templateId)}" style="white-space:nowrap; background:#d32f2f; color:white;">
              🗑️ Delete
            </button>
          </div>
        </div>
      `;

      // View template button
      templateCard.querySelector(".view-template-btn").addEventListener("click", () => {
        if (url && url.trim() !== "") {
          window.open(url, "_blank");
        } else {
          alert("Template URL not available.");
        }
      });

      // Delete template button
      templateCard.querySelector(".delete-template-btn").addEventListener("click", async () => {
        if (!confirm(`Are you sure you want to delete the template for "${documentType}"?\n\nThis action cannot be undone.`)) {
          return;
        }

        try {
          // Delete from Firestore
          const templateDocRef = doc(db, "applications", appType, "templates", templateId);
          await deleteDoc(templateDocRef);

          // Note: We're not deleting from Storage to avoid breaking links
          // Storage files can be cleaned up manually if needed

          alert(`✅ Template "${documentType}" deleted successfully.`);

          // Reload templates list
          await loadExistingTemplates(appType);
        } catch (err) {
          console.error("❌ Error deleting template:", err);
          alert("Failed to delete template: " + err.message);
        }
      });

      existingTemplatesList.appendChild(templateCard);
    }
  } catch (err) {
    console.error("❌ Error loading existing templates:", err);
    existingTemplatesList.innerHTML = `
      <p style='text-align:center; color:#d32f2f; padding:20px;'>
        Error loading templates: ${err.message}
      </p>
    `;
  }
}

// ------------------ INITIALIZE SCHEDULE MODAL ------------------
function initScheduleModal() {
  scheduleContainer = document.getElementById("scheduleContainer");
  scheduleBtn = document.getElementById("scheduleBtn");
  scheduleModal = document.getElementById("scheduleModal");
  closeModal = document.getElementById("closeModal");
  saveAppointmentBtn = document.getElementById("saveAppointmentBtn");

  if (!scheduleModal) return; // Elements not ready yet

  scheduleBtn?.addEventListener("click", () => {
    if (!currentOpenUserId) return alert("Select an applicant first.");
    
    if (!currentSubmissionId) {
      alert("Please select a submission first.");
      return;
    }
    
    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    
    const walkInDateInput = document.getElementById("walkInDate");
    const walkInTimeInput = document.getElementById("walkInTime");
    
    if (walkInDateInput) {
      walkInDateInput.value = tomorrowStr;
      walkInDateInput.min = today; // Prevent selecting past dates
    }
    if (walkInTimeInput) walkInTimeInput.value = "09:00"; // Default to 9:00 AM
    
    showModal(scheduleModal);
  });
  closeModal?.addEventListener(
    "click",
    () => (scheduleModal.style.display = "none")
  );
  window.addEventListener("click", (event) => {
    if (event.target === scheduleModal) scheduleModal.style.display = "none";
  });

  saveAppointmentBtn?.addEventListener("click", async () => {
    try {
      if (!currentOpenUserId) {
        alert("Select an applicant first.");
        return;
      }
      
      if (!currentSubmissionId) {
        alert("No submission selected.");
        return;
      }

      // get applicant info that was set by setCurrentApplicant
      const applicantData = JSON.parse(
        localStorage.getItem("currentApplicantData") || "{}"
      );
      const applicantName =
        applicantData.applicantName || applicantData.name || "Unnamed Applicant";

      const walkInPurpose =
        document.getElementById("walkInPurpose")?.value.trim() || "";
      const walkInDate =
        document.getElementById("walkInDate")?.value || "";
      const walkInTime =
        document.getElementById("walkInTime")?.value || "";
      const walkInRemarks =
        document.getElementById("walkInAppointmentRemarks")?.value.trim() || "";

      if (!walkInPurpose) {
        alert("Please enter a purpose for the appointment.");
        return;
      }

      if (!walkInDate) {
        alert("Please select an appointment date.");
        return;
      }

      if (!walkInTime) {
        alert("Please select an appointment time.");
        return;
      }

      // Combine date and time into a single timestamp
      const appointmentDateTime = new Date(`${walkInDate}T${walkInTime}`);
      
      // Validate that the appointment is not in the past
      const now = new Date();
      if (appointmentDateTime < now) {
        alert("⚠️ Appointment date and time cannot be in the past.");
        return;
      }

      const adminId = "admin001"; // TODO: replace with actual logged-in admin id/email

      // Fetch all existing walk-in appointments to determine the next index
      const snapshot = await getDocs(collection(db, "appointments"));
      const existingDocs = snapshot.docs
        .filter((docSnap) => docSnap.id.startsWith("walk_in_appointment_"))
        .map((docSnap) => docSnap.id);

      // Determine the next available index
      let maxIndex = 0;
      existingDocs.forEach((id) => {
        const num = parseInt(id.replace("walk_in_appointment_", ""));
        if (!isNaN(num) && num > maxIndex) {
          maxIndex = num;
        }
      });

      const nextIndex = String(maxIndex + 1).padStart(2, "0");
      const newDocId = `walk_in_appointment_${nextIndex}`;

      // Create appointment in Firestore with custom document ID
      await setDoc(doc(db, "appointments", newDocId), {
        adminId,
        applicantId: currentOpenUserId,
        applicantName,
        appointmentType: "Walk-in Appointment",
        appointmentId: currentSubmissionId, // Store the submission ID
        purpose: walkInPurpose,
        scheduledDate: appointmentDateTime.toISOString().split('T')[0], // Store date separately
        scheduledTime: walkInTime, // Store time separately
        scheduledAt: appointmentDateTime, // Store complete timestamp
        location: "Aparri Municipal DENR Office",
        remarks: walkInRemarks,
        status: "Scheduled",
        treeIds: [],
        createdAt: serverTimestamp(),
      });
      
      // Get the userId from applicant data to send notification
      const applicantRef = doc(
        db,
        "applications",
        currentApplicationType,
        "applicants",
        currentOpenUserId
      );
      const applicantSnap = await getDoc(applicantRef);
      
      if (applicantSnap.exists()) {
        const applicantDataFromDb = applicantSnap.data();
        const userId = applicantDataFromDb.userId;
        
        if (userId) {
          // Create notification for the user
          const notificationsRef = collection(db, "users", userId, "notifications");
          await addDoc(notificationsRef, {
            title: "Walk-in Appointment Scheduled",
            message: `Your walk-in appointment for submission ${currentSubmissionId} has been scheduled for ${appointmentDateTime.toLocaleString()}.`,
            appointmentId: currentSubmissionId, // Store the submission ID as appointmentId
            timestamp: serverTimestamp(),
            read: false,
            type: "walk-in-appointment"
          });
        }
      }

      alert(
        `✅ Walk-in appointment "${newDocId}" scheduled successfully!\n\n` +
        `Applicant: ${applicantName}\n` +
        `Submission: ${currentSubmissionId}\n` +
        `Date: ${appointmentDateTime.toLocaleDateString()}\n` +
        `Time: ${appointmentDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n` +
        `Purpose: ${walkInPurpose}`
      );
      scheduleModal.style.display = "none";

      // Clear modal inputs
      document.getElementById("walkInPurpose").value = "";
      document.getElementById("walkInDate").value = "";
      document.getElementById("walkInTime").value = "";
      document.getElementById("walkInAppointmentRemarks").value = "";
    } catch (err) {
      console.error("❌ Error saving walk-in appointment:", err);
      alert("Failed to record appointment: " + err.message);
    }
  });
}

// ------------------ MAIN INITIALIZATION ------------------
function initElements() {
  initGlobalModalBehavior();

  // Get main container elements
  applicantsContainer = document.getElementById("applicantsContainer");
  filesSection = document.getElementById("filesSection");
  filesBody = document.getElementById("filesBody");
  applicantTitle = document.getElementById("applicantTitle");
  applicationTypeTitle = document.getElementById("applicationTypeTitle");
  applicationTypeHeader = document.getElementById("applicationTypeHeader");
  
  // Get button elements
  proceedBtn = document.getElementById("proceedBtn");
  commentBtn = document.getElementById("commentBtn");
  scheduleBtn = document.getElementById("scheduleBtn");
  claimCertificateBtn = document.getElementById("claimCertificateBtn");
  manageTemplatesBtn = document.getElementById("manageTemplatesBtn");

  // Initialize modal systems
  initScheduleModal();
  initCommentModal();
  initClaimCertificateModal();
  initTemplateModal();

  // logoutBtn lives inside the dynamically-inserted sidebar
  const _logoutBtn = document.getElementById("logoutBtn");
  if (_logoutBtn) _logoutBtn.addEventListener("click", logout);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initElements);
} else {
  // DOM already loaded
  initElements();
}
