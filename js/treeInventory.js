import { db } from "./script.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  setDoc,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ------------------ ELEMENTS (Lazy-loaded) ------------------
let proceedBtn, inventoryModal, closeInventoryModal;
let foresterCheckboxList, applicantNameInput, appointmentType, appointmentLocation, appointmentRemarks;
let reviewAppointmentBtn, inventoryFormStep, inventoryReviewStep, backToEditBtn, confirmAppointmentBtn;
let reviewApplicant, reviewType, reviewDate, reviewLocation, reviewRemarks, reviewForesters;

function initElements() {
  proceedBtn = document.getElementById("proceedBtn");
  inventoryModal = document.getElementById("inventoryModal");
  closeInventoryModal = document.getElementById("closeInventoryModal");
  
  foresterCheckboxList = document.getElementById("foresterCheckboxList");
  applicantNameInput = document.getElementById("applicantNameInput");
  appointmentType = document.getElementById("appointmentType");
  appointmentLocation = document.getElementById("appointmentLocation");
  appointmentRemarks = document.getElementById("appointmentRemarks");
  
  reviewAppointmentBtn = document.getElementById("reviewAppointmentBtn");
  inventoryFormStep = document.getElementById("inventoryFormStep");
  inventoryReviewStep = document.getElementById("inventoryReviewStep");
  backToEditBtn = document.getElementById("backToEditBtn");
  confirmAppointmentBtn = document.getElementById("confirmAppointmentBtn");
  
  reviewApplicant = document.getElementById("reviewApplicant");
  reviewType = document.getElementById("reviewType");
  reviewDate = document.getElementById("reviewDate");
  reviewLocation = document.getElementById("reviewLocation");
  reviewRemarks = document.getElementById("reviewRemarks");
  reviewForesters = document.getElementById("reviewForesters");
  
  attachEventListeners();
}

// ------------------ VARIABLES ------------------
let currentApplicantId = null;
let currentApplicantData = null;
let currentApplicationType = null;
let currentSubmissionId = null;
let currentAppointmentMode = 'new'; // 'new', 'revisit', or 'modify'
let existingAppointmentId = null;
let existingAppointmentData = null;
let ctpoReferenceId = null; // ✅ For PLTP/SPLTP - reference to CTPO appointment
let adminId = null; // ✅ Will store logged-in admin's Gmail

function setFieldVisibility(fieldEl, visible) {
  if (!fieldEl) return;
  const fieldLabel = fieldEl.id
    ? document.querySelector(`label[for="${fieldEl.id}"]`)
    : null;

  fieldEl.style.display = visible ? "block" : "none";
  if (fieldLabel) fieldLabel.style.display = visible ? "block" : "none";
}

// ------------------ AUTH ------------------
const auth = getAuth();
onAuthStateChanged(auth, (user) => {
  if (user) {
    adminId = user.email; // ✅ Gmail of logged-in admin
    console.log("✅ Logged in as:", adminId);
  } else {
    console.warn("⚠️ No admin logged in");
  }
});

// ------------------ FUNCTIONS ------------------
export function setCurrentApplicant(userId, userData = {}) {
  currentApplicantId = userId;
  currentApplicantData = userData;
  console.log("✅ Tree Inventory - Current applicant set:", userId, userData);
}

export function setCurrentApplication(appType, submissionId) {
  currentApplicationType = appType;
  currentSubmissionId = submissionId;
  console.log("✅ Tree Inventory - Current application set:", { appType, submissionId });
}

export function setAppointmentMode(mode, appointmentId = null, appointmentData = null, ctpoReference = null) {
  currentAppointmentMode = mode; // 'new', 'revisit', or 'modify'
  existingAppointmentId = appointmentId;
  existingAppointmentData = appointmentData;
  ctpoReferenceId = ctpoReference; // Store CTPO reference for PLTP/SPLTP
  console.log("✅ Tree Inventory - Appointment mode set:", { mode, appointmentId, ctpoReference });
}

// Load all active foresters into a clickable selection list
async function loadForesters() {
  if (!foresterCheckboxList) return;

  const existingSelections = Array.from(
    foresterCheckboxList.querySelectorAll("[data-forester-id].selected")
  ).map((item) => item.dataset.foresterId);

  foresterCheckboxList.innerHTML = "<p class='text-sm text-slate-500'>Loading foresters...</p>";
  const q = query(
    collection(db, "users"),
    where("role", "==", "Forester"),
    where("active", "==", true)
  );
  const snapshot = await getDocs(q);

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;
    const name = data.name || "Unnamed Forester";
    const item = document.createElement("button");
    item.type = "button";
    item.dataset.foresterId = id;
    item.className = "flex w-full items-center rounded-xl border px-3 py-3 text-left text-sm font-medium transition";
    item.textContent = name;

    const applySelectedState = (isSelected) => {
      item.classList.toggle("selected", isSelected);
      item.classList.toggle("border-forest-700", isSelected);
      item.classList.toggle("bg-forest-100", isSelected);
      item.classList.toggle("text-forest-900", isSelected);
      item.classList.toggle("border-emerald-100", !isSelected);
      item.classList.toggle("bg-white", !isSelected);
      item.classList.toggle("text-slate-700", !isSelected);
      item.classList.toggle("hover:border-emerald-300", !isSelected);
      item.classList.toggle("hover:bg-emerald-100/60", !isSelected);
    };

    applySelectedState(existingSelections.includes(id));

    item.addEventListener("click", () => {
      const isSelected = item.classList.contains("selected");
      applySelectedState(!isSelected);
    });
    foresterCheckboxList.appendChild(item);
  });
}

function getSelectedForesterIds() {
  if (!foresterCheckboxList) return [];

  return Array.from(foresterCheckboxList.querySelectorAll("[data-forester-id].selected")).map(
    (item) => item.dataset.foresterId
  );
}

function getSelectedForesterNames() {
  if (!foresterCheckboxList) return [];

  return Array.from(foresterCheckboxList.querySelectorAll("[data-forester-id].selected")).map(
    (item) => item.textContent.trim()
  );
}

// ------------------ EVENT LISTENER ATTACHMENT ------------------
function attachEventListeners() {
  // ------------------ OPEN MODAL ------------------
  if (proceedBtn) {
    proceedBtn.addEventListener("click", async () => {
      if (!currentApplicantId) return alert("⚠️ Select an applicant first.");
      if (!currentSubmissionId) return alert("⚠️ Select a submission first.");

      applicantNameInput.value =
        currentApplicantData?.applicantName ||
        currentApplicantData?.name ||
        "Selected applicant";

      // Reset modal to form view
      inventoryModal.style.display = "flex";
      inventoryFormStep.style.display = "block";
      inventoryReviewStep.style.display = "none";

      // **IMPORTANT**: Reset ALL field visibility first (regardless of previous state)
      appointmentType.style.display = "block";
      appointmentLocation.style.display = "block";
      appointmentRemarks.style.display = "block";
      appointmentType.disabled = false;
      appointmentLocation.disabled = false;
      appointmentRemarks.disabled = false;
      if (foresterCheckboxList) foresterCheckboxList.style.display = "block";
      
      // Show all labels
      const allLabels = inventoryFormStep.querySelectorAll('label');
      allLabels.forEach(label => {
        label.style.display = "block";
      });

      const loadForestersPromise = loadForesters();
      if (reviewAppointmentBtn) {
        reviewAppointmentBtn.disabled = true;
        reviewAppointmentBtn.style.display = "block";
        loadForestersPromise.finally(() => {
          reviewAppointmentBtn.disabled = false;
        });
      }

      // Refresh applicant name in background when available from users collection.
      const userRef = doc(db, "users", currentApplicantId);
      getDoc(userRef)
        .then((userSnap) => {
          if (userSnap.exists()) {
            const applicantData = userSnap.data();
            applicantNameInput.value = applicantData.name || applicantNameInput.value;
          }
        })
        .catch((err) => {
          console.warn("⚠️ Could not refresh applicant name:", err);
        });

      // Configure modal based on mode
      const modalTitle = inventoryModal.querySelector('h2');
      
      if (currentAppointmentMode === 'new') {
        // New tree tagging appointment
        modalTitle.textContent = '🌲 Tree Tagging Appointment';
        appointmentType.value = 'Tree Tagging';
        appointmentType.disabled = true;
        appointmentLocation.value = '';
        appointmentRemarks.value = '';
        if (foresterCheckboxList) {
          foresterCheckboxList.querySelectorAll("[data-forester-id]").forEach((item) => {
            item.classList.remove("selected", "border-forest-700", "bg-forest-100", "text-forest-900");
            item.classList.add("border-emerald-100", "bg-white", "text-slate-700");
            item.classList.add("hover:border-emerald-300", "hover:bg-emerald-100/60");
          });
        }
        
        // Hide appointment type field, show location and remarks
        appointmentType.style.display = "none";
        appointmentLocation.style.display = "block";
        appointmentRemarks.style.display = "block";
        appointmentLocation.disabled = false;
        appointmentRemarks.disabled = false;
        if (foresterCheckboxList) foresterCheckboxList.style.display = "block";
        
        // Hide type label, show location and remarks labels
        const allLabels = inventoryFormStep.querySelectorAll('label');
        allLabels.forEach(label => {
          if (label.textContent.includes('Type')) {
            label.style.display = "none";
          } else {
            label.style.display = "block";
          }
        });
        
      } else if (currentAppointmentMode === 'revisit') {
        // Revisit appointment
        modalTitle.textContent = '🔄 Schedule Revisit Appointment';
        appointmentType.value = 'Revisit';
        appointmentType.disabled = true;
        appointmentLocation.value = '';
        appointmentRemarks.value = '';
        if (foresterCheckboxList) {
          foresterCheckboxList.querySelectorAll("[data-forester-id]").forEach((item) => {
            item.classList.remove("selected", "border-forest-700", "bg-forest-100", "text-forest-900");
            item.classList.add("border-emerald-100", "bg-white", "text-slate-700");
            item.classList.add("hover:border-emerald-300", "hover:bg-emerald-100/60");
          });
        }
        
        // Hide appointment type field, show location and remarks
        appointmentType.style.display = "none";
        appointmentLocation.style.display = "block";
        appointmentRemarks.style.display = "block";
        appointmentLocation.disabled = false;
        appointmentRemarks.disabled = false;
        if (foresterCheckboxList) foresterCheckboxList.style.display = "block";
        
        // Hide type label, show location and remarks labels
        const allLabels2 = inventoryFormStep.querySelectorAll('label');
        allLabels2.forEach(label => {
          if (label.textContent.includes('Type')) {
            label.style.display = "none";
          } else {
            label.style.display = "block";
          }
        });
        
      } else if (currentAppointmentMode === 'modify') {
        // Modify existing appointment details and forester assignment
        modalTitle.textContent = '✏️ Modify Forester Assignment';

        await loadForestersPromise;
        
        if (existingAppointmentData) {
          appointmentType.value = existingAppointmentData.appointmentType || 'Tree Tagging';
          appointmentLocation.value = existingAppointmentData.location || '';
          appointmentRemarks.value = existingAppointmentData.remarks || '';
          
          // Pre-select existing foresters
          const existingForesterIds = existingAppointmentData.foresterIds || [];
          Array.from(foresterCheckboxList?.querySelectorAll("[data-forester-id]") || []).forEach((item) => {
            const isSelected = existingForesterIds.includes(item.dataset.foresterId);
            item.classList.toggle("selected", isSelected);
            item.classList.toggle("border-forest-700", isSelected);
            item.classList.toggle("bg-forest-100", isSelected);
            item.classList.toggle("text-forest-900", isSelected);
            item.classList.toggle("border-emerald-100", !isSelected);
            item.classList.toggle("bg-white", !isSelected);
            item.classList.toggle("text-slate-700", !isSelected);
            item.classList.toggle("hover:border-emerald-300", !isSelected);
            item.classList.toggle("hover:bg-emerald-100/60", !isSelected);
          });
        }
        
        // Keep details visible in modify mode so the modal layout remains stable
        // and admins can adjust assignment details.
        appointmentType.disabled = true;
        appointmentLocation.disabled = false;
        appointmentRemarks.disabled = false;
        appointmentType.style.display = "none";
        appointmentLocation.style.display = "block";
        appointmentRemarks.style.display = "block";
        
        // Hide the labels for hidden fields
        const allLabels = inventoryFormStep.querySelectorAll('label');
        allLabels.forEach(label => {
          if (label.textContent.includes('Type')) {
            label.style.display = "none";
          } else {
            label.style.display = "block";
          }
        });
        
        // Ensure forester list and review button are visible
        if (foresterCheckboxList) foresterCheckboxList.style.display = "block";
      } else {
        await loadForestersPromise;
      }
    });
  }

  if (closeInventoryModal) {
    closeInventoryModal.addEventListener("click", () => {
      inventoryModal.style.display = "none";
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === inventoryModal) inventoryModal.style.display = "none";
  });

  // ------------------ REVIEW STEP ------------------
  if (reviewAppointmentBtn) {
    reviewAppointmentBtn.addEventListener("click", () => {
      const selectedForesters = getSelectedForesterIds();

      if (selectedForesters.length === 0)
        return alert("⚠️ Please select at least one forester.");
      
      // Validate location for all modes (modify mode is prefilled but still editable).
      if (!appointmentLocation.value.trim()) {
        alert("⚠️ Please enter a location.");
        return;
      }

      // Populate review details
      reviewApplicant.textContent = applicantNameInput.value;
      reviewType.textContent = appointmentType.value;
      reviewDate.textContent = currentAppointmentMode === 'modify' 
        ? "⏱ Existing appointment - no date change" 
        : "⏱ Automatically set when created";
      reviewLocation.textContent = appointmentLocation.value || existingAppointmentData?.location || "N/A";
      reviewRemarks.textContent = appointmentRemarks.value || existingAppointmentData?.remarks || "None";
      reviewForesters.innerHTML = getSelectedForesterNames().join(", ");

      // Switch view
      inventoryFormStep.style.display = "none";
      inventoryReviewStep.style.display = "block";
    });
  }

  // ------------------ BACK TO EDIT ------------------
  if (backToEditBtn) {
    backToEditBtn.addEventListener("click", () => {
      inventoryFormStep.style.display = "block";
      inventoryReviewStep.style.display = "none";
    });
  }

  // ------------------ CONFIRM APPOINTMENT ------------------
  if (confirmAppointmentBtn) {
    confirmAppointmentBtn.addEventListener("click", async () => {
      const selectedForesters = getSelectedForesterIds();

      if (selectedForesters.length === 0)
        return alert("⚠️ Please select at least one forester.");

      try {
        if (currentAppointmentMode === 'modify') {
          // Update existing appointment's forester list only
          if (!existingAppointmentId) {
            return alert("⚠️ No appointment ID found for modification.");
          }
          
          await setDoc(doc(db, "appointments", existingAppointmentId), {
            foresterIds: selectedForesters,
            lastModifiedAt: serverTimestamp(),
            lastModifiedBy: adminId
          }, { merge: true });
          
          alert(`✅ Forester assignment updated for appointment "${existingAppointmentId}"`);
          
        } else {
          // Create new appointment (tree tagging or revisit)
          // 🔹 Determine appointment type and document ID prefix based on mode
          const isRevisit = currentAppointmentMode === 'revisit';
          const appointmentTypeValue = isRevisit ? 'Revisit' : 'Tree Tagging';
          const docPrefix = isRevisit ? "revisit_appointment_" : "tree_tagging_appointment_";
          
          // 🔹 Fetch all existing appointments of this type
          const snapshot = await getDocs(collection(db, "appointments"));
          const existingDocs = snapshot.docs
            .filter((docSnap) => docSnap.id.startsWith(docPrefix))
            .map((docSnap) => docSnap.id);

          // 🔹 Determine the next available index
          let maxIndex = 0;
          existingDocs.forEach((id) => {
            const num = parseInt(id.replace(docPrefix, ""));
            if (!isNaN(num) && num > maxIndex) {
              maxIndex = num;
            }
          });

          const nextIndex = String(maxIndex + 1).padStart(2, "0");
          const newDocId = `${docPrefix}${nextIndex}`;

          // 🔹 For revisit appointments, find the completed tree tagging appointment
          let originalAppointmentId = null;
          if (isRevisit) {
            // Find completed tree tagging appointment for this submission
            const appointmentsQuery = query(
              collection(db, "appointments"),
              where("applicationID", "==", currentSubmissionId),
              where("appointmentType", "==", "Tree Tagging"),
              where("status", "==", "Completed")
            );
            const completedAppointmentsSnap = await getDocs(appointmentsQuery);
            
            if (!completedAppointmentsSnap.empty) {
              originalAppointmentId = completedAppointmentsSnap.docs[0].id;
              console.log("✅ Found completed tree tagging appointment:", originalAppointmentId);
            } else {
              console.warn("⚠️ No completed tree tagging appointment found for this submission");
            }
          }

          // 🔹 Create the new appointment document
          await setDoc(doc(db, "appointments", newDocId), {
            adminId,
            applicantId: currentApplicantId,
            applicantName: applicantNameInput.value,
            appointmentType: appointmentTypeValue, // 'Tree Tagging' or 'Revisit'
            applicationType: currentApplicationType,
            applicationID: currentSubmissionId, // ✅ The submission ID
            location: appointmentLocation.value.trim(),
            status: "Pending",
            treeIds: [],
            remarks: appointmentRemarks.value || "",
            createdAt: serverTimestamp(),
            completedAt: null,
            foresterIds: selectedForesters, // ✅ multiple foresters in one doc
            ...(isRevisit && originalAppointmentId && { originalAppointmentRef: originalAppointmentId })
          });

          // 🔹 For revisit appointments, copy tree inventory data
          if (isRevisit && originalAppointmentId) {
            try {
              console.log("📋 Copying tree inventory data for revisit...");
              
              // Get all trees from the original tree inventory
              const treeInventoryRef = collection(db, "appointments", originalAppointmentId, "tree_inventory");
              const treeInventorySnap = await getDocs(treeInventoryRef);
              
              if (!treeInventorySnap.empty) {
                console.log(`📊 Found ${treeInventorySnap.size} tree(s) to copy`);
                
                // Create tree_revisit subcollection in the new revisit appointment
                const treeRevisitRef = collection(db, "appointments", newDocId, "tree_revisit");
                
                // Copy each tree with old data and empty new data
                for (const treeDoc of treeInventorySnap.docs) {
                  const treeId = treeDoc.id;
                  const treeData = treeDoc.data();
                  
                  // Create reference to original tree document
                  const originalTreeRef = doc(db, "appointments", originalAppointmentId, "tree_inventory", treeId);
                  
                  // Prepare old data (copy all relevant fields from original tree)
                  const oldData = {
                    height: treeData.height || null,
                    diameter: treeData.diameter || null,
                    specie: treeData.specie || null,
                    latitude: treeData.latitude || null,
                    longitude: treeData.longitude || null,
                    photo_url: treeData.photo_url || null,
                    tree_status: treeData.tree_status || null,
                    volume: treeData.volume || null,
                    qr_url: treeData.qr_url || null,
                    tree_no: treeData.tree_no || null,
                    timestamp: treeData.timestamp || null,
                    forester_name: treeData.forester_name || null,
                    forester_id: treeData.forester_id || null
                  };
                  
                  // Create tree_revisit document with reference and old data
                  await setDoc(doc(treeRevisitRef, treeId), {
                    tree_tagging_ref: originalTreeRef, // Reference to original tree document
                    old: oldData, // Old tree data
                    new: {
                      // Empty fields to be filled by foresters during revisit
                      height: null,
                      diameter: null,
                      specie: null,
                      tree_status: null,
                      volume: null,
                      photo_url: null,
                      qr_url: null,
                      updatedAt: null,
                      forester_name: null,
                      forester_id: null
                    },
                    treeId: treeId,
                    createdAt: serverTimestamp()
                  });
                  
                  console.log(`✅ Copied tree ${treeId} to revisit appointment`);
                }
                
                console.log(`✅ Successfully copied ${treeInventorySnap.size} tree(s) for revisit`);
              } else {
                console.warn("⚠️ No trees found in original appointment to copy");
              }
            } catch (copyError) {
              console.error("❌ Error copying tree inventory for revisit:", copyError);
              // Don't fail the entire appointment creation, just log the error
            }
          }
          
          // 🔹 For PLTP/SPLTP tree tagging, copy tree inventory from CTPO reference
          if (!isRevisit && ctpoReferenceId && (currentApplicationType === 'pltp' || currentApplicationType === 'splt')) {
            try {
              console.log("📋 Copying tree inventory data from CTPO reference:", ctpoReferenceId);
              
              // 🔹 PRIORITY 1: Check if there's a completed CTPO revisit appointment
              const ctpoRevisitQuery = query(
                collection(db, "appointments"),
                where("applicationID", "==", ctpoReferenceId),
                where("appointmentType", "==", "Revisit"),
                where("status", "==", "Completed")
              );
              const ctpoRevisitSnap = await getDocs(ctpoRevisitQuery);
              
              let sourceAppointmentId = null;
              let sourceCollection = null;
              let useRevisitData = false;
              
              if (!ctpoRevisitSnap.empty) {
                // Found completed revisit - use tree_revisit data
                sourceAppointmentId = ctpoRevisitSnap.docs[0].id;
                sourceCollection = "tree_revisit";
                useRevisitData = true;
                console.log("✅ Found completed CTPO revisit appointment:", sourceAppointmentId);
                console.log("📋 Will use tree_revisit data (most recent)");
              } else {
                // 🔹 PRIORITY 2: No completed revisit, use original tree tagging
                console.log("⚠️ No completed CTPO revisit found, checking tree tagging...");
                const ctpoAppointmentsQuery = query(
                  collection(db, "appointments"),
                  where("applicationID", "==", ctpoReferenceId),
                  where("appointmentType", "==", "Tree Tagging"),
                  where("status", "==", "Completed")
                );
                const ctpoAppointmentsSnap = await getDocs(ctpoAppointmentsQuery);
                
                if (!ctpoAppointmentsSnap.empty) {
                  sourceAppointmentId = ctpoAppointmentsSnap.docs[0].id;
                  sourceCollection = "tree_inventory";
                  useRevisitData = false;
                  console.log("✅ Found completed CTPO tree tagging appointment:", sourceAppointmentId);
                  console.log("📋 Will use tree_inventory data");
                }
              }
              
              if (sourceAppointmentId && sourceCollection) {
                // Get all trees from the source collection
                const sourceTreeRef = collection(db, "appointments", sourceAppointmentId, sourceCollection);
                const sourceTreeSnap = await getDocs(sourceTreeRef);
                
                if (!sourceTreeSnap.empty) {
                  console.log(`📊 Found ${sourceTreeSnap.size} tree(s) from CTPO ${sourceCollection} to copy`);
                  
                  // Create tree_inventory subcollection in the new PLTP/SPLTP appointment
                  const newTreeInventoryRef = collection(db, "appointments", newDocId, "tree_inventory");
                  
                  // Copy each tree's data directly from CTPO
                  for (const treeDoc of sourceTreeSnap.docs) {
                    const treeId = treeDoc.id;
                    const treeData = treeDoc.data();
                    
                    let copiedTreeData;
                    let ctpoTreeRef;
                    
                    if (useRevisitData) {
                      // Using revisit data - extract the "new" data (updated measurements)
                      copiedTreeData = {
                        height: treeData.new?.height || treeData.old?.height || null,
                        diameter: treeData.new?.diameter || treeData.old?.diameter || null,
                        specie: treeData.new?.specie || treeData.old?.specie || null,
                        latitude: treeData.old?.latitude || null, // Location doesn't change
                        longitude: treeData.old?.longitude || null,
                        photo_url: treeData.new?.photo_url || treeData.old?.photo_url || "",
                        qr_url: treeData.old?.qr_url || "",
                        tree_status: treeData.new?.tree_status || treeData.old?.tree_status || "Not Yet Ready",
                        volume: treeData.new?.volume || treeData.old?.volume || null,
                        tree_no: treeData.old?.tree_no || null,
                        tree_id: treeId,
                        forester_name: treeData.new?.forester_name || treeData.old?.forester_name || "",
                        forester_id: treeData.new?.forester_id || treeData.old?.forester_id || "",
                        timestamp: treeData.new?.updatedAt || treeData.old?.timestamp || serverTimestamp()
                      };
                      // Reference points to the revisit document
                      ctpoTreeRef = doc(db, "appointments", sourceAppointmentId, "tree_revisit", treeId);
                      console.log(`  📋 Using revisit data for tree ${treeId}`);
                    } else {
                      // Using original tree inventory data
                      copiedTreeData = {
                        height: treeData.height || null,
                        diameter: treeData.diameter || null,
                        specie: treeData.specie || null,
                        latitude: treeData.latitude || null,
                        longitude: treeData.longitude || null,
                        photo_url: treeData.photo_url || "",
                        qr_url: treeData.qr_url || "",
                        tree_status: treeData.tree_status || "Not Yet Ready",
                        volume: treeData.volume || null,
                        tree_no: treeData.tree_no || null,
                        tree_id: treeId,
                        forester_name: treeData.forester_name || "",
                        forester_id: treeData.forester_id || "",
                        timestamp: treeData.timestamp || serverTimestamp()
                      };
                      // Reference points to the original tree inventory document
                      ctpoTreeRef = doc(db, "appointments", sourceAppointmentId, "tree_inventory", treeId);
                      console.log(`  📋 Using tree inventory data for tree ${treeId}`);
                    }
                    
                    // Copy all tree data fields directly from CTPO
                    await setDoc(doc(newTreeInventoryRef, treeId), {
                      // Copy all fields directly from CTPO (no empty fields)
                      ...copiedTreeData,
                      appointment_id: newDocId,
                      tree_tagging_appointment_id: null, // Will be set when foresters verify
                      ctpo_reference_source: ctpoTreeRef.path, // Store reference path for tracking
                      source_type: useRevisitData ? 'revisit' : 'tree_tagging' // Track data source
                    });
                    
                    console.log(`✅ Copied tree ${treeId} from CTPO ${sourceCollection} to ${currentApplicationType.toUpperCase()} appointment`);
                  }
                  
                  console.log(`✅ Successfully copied ${sourceTreeSnap.size} tree(s) from CTPO ${sourceCollection}`);
                } else {
                  console.warn(`⚠️ No trees found in CTPO ${sourceCollection} to copy`);
                }
              } else {
                console.warn("⚠️ No completed CTPO appointment found for reference:", ctpoReferenceId);
              }
            } catch (copyError) {
              console.error("❌ Error copying tree inventory from CTPO reference:", copyError);
              // Don't fail the entire appointment creation, just log the error
            }
          }

          alert(
            `✅ ${appointmentType.value} appointment "${newDocId}" assigned to ${selectedForesters.length} forester(s).${isRevisit ? '\n\n📋 Tree inventory data has been copied for revisit.' : ''}`
          );
        }
        
        inventoryModal.style.display = "none";

        // Reset form
        appointmentType.value = "";
        appointmentType.disabled = false;
        appointmentLocation.value = "";
        appointmentLocation.disabled = false;
        appointmentRemarks.value = "";
        appointmentRemarks.disabled = false;
        if (foresterCheckboxList) {
          foresterCheckboxList.querySelectorAll("[data-forester-id]").forEach((item) => {
            item.classList.remove("selected", "border-forest-700", "bg-forest-100", "text-forest-900");
            item.classList.add("border-emerald-100", "bg-white", "text-slate-700");
            item.classList.add("hover:border-emerald-300", "hover:bg-emerald-100/60");
          });
        }
        
        // Reset mode
        currentAppointmentMode = 'new';
        existingAppointmentId = null;
        existingAppointmentData = null;
        
        // Show location and remarks fields, keep type hidden
        setFieldVisibility(appointmentType, false);
        setFieldVisibility(appointmentLocation, true);
        setFieldVisibility(appointmentRemarks, true);
      } catch (err) {
        console.error("❌ Error creating/updating appointment:", err);
        alert("Failed to process appointment: " + err.message);
      }
    });
  }
}

// ------------------ INITIALIZE ON DOM LOAD ------------------
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initElements);
} else {
  // DOM already loaded
  initElements();
}