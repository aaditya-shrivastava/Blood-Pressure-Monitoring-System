import { loginWithGoogle, logoutUser, onAuthChange, db } from "./firebase.js";
import {
  collection, addDoc, deleteDoc, getDocs, doc,
  query, orderBy, setDoc, getDoc, where, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let chart = null;
let currentUser = null;
let currentProfile = null; // { id, name, ownerId, role: 'owner'|'editor' }

/* ==========================
   Auth
========================== */

document.getElementById("btnLogin").addEventListener("click", async () => {
  try { await loginWithGoogle(); }
  catch { toast("Sign-in failed. Please try again."); }
});

["btnLogout", "btnLogoutProfile"].forEach(id => {
  document.getElementById(id).addEventListener("click", async () => {
    await logoutUser();
    showScreen("login");
  });
});

document.getElementById("btnBack").addEventListener("click", () => {
  currentProfile = null;
  showScreen("profile");
  loadProfileScreen();
});

onAuthChange(async (user) => {
  if (user) {
    currentUser = user;
    setAvatars(user);
    showScreen("profile");
    await loadProfileScreen();
  } else {
    currentUser = null;
    currentProfile = null;
    showScreen("login");
  }
});

function setAvatars(user) {
  ["profileAvatar", "userAvatar"].forEach(id => {
    const el = document.getElementById(id);
    if (user.photoURL) { el.src = user.photoURL; el.style.display = "inline-block"; }
    else el.style.display = "none";
  });
  document.getElementById("profileUserName").textContent = user.displayName || user.email;
}

function showScreen(name) {
  document.getElementById("loginScreen").style.display   = name === "login"   ? "flex" : "none";
  document.getElementById("profileScreen").style.display = name === "profile" ? "block" : "none";
  document.getElementById("appScreen").style.display     = name === "app"     ? "block" : "none";
}

/* ==========================
   Profile Screen
========================== */

async function loadProfileScreen() {
  await Promise.all([loadMyProfiles(), loadSharedProfiles(), loadPendingInvites()]);
}

async function loadMyProfiles() {
  const snap = await getDocs(collection(db, "users", currentUser.uid, "profiles"));
  const profiles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const container = document.getElementById("myProfilesList");

  if (!profiles.length) {
    container.innerHTML = `<div class="empty-state" style="padding:1rem 0;">No profiles yet. Create one to get started.</div>`;
    return;
  }

  container.innerHTML = profiles.map(p => `
    <div class="profile-card" onclick="openProfile('${p.id}', '${escHtml(p.name)}', 'owner')">
      <div class="profile-icon">${escHtml(p.name.charAt(0).toUpperCase())}</div>
      <div class="profile-name">${escHtml(p.name)}</div>
      <div class="profile-actions" onclick="event.stopPropagation()">
        <button class="btn-profile-action" onclick="openInviteModal('${p.id}', '${escHtml(p.name)}')" title="Share">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </button>
        <button class="btn-profile-action danger" onclick="deleteProfile('${p.id}', '${escHtml(p.name)}')" title="Delete">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </button>
      </div>
    </div>
  `).join("");
}

async function loadSharedProfiles() {
  // Query by editorId field — works with the security rules
  const q = query(
    collection(db, "sharedAccess"),
    where("editorId", "==", currentUser.uid)
  );
  const snap = await getDocs(q);
  const shared = snap.docs.map(d => ({ accessId: d.id, ...d.data() }));
  const section = document.getElementById("sharedSection");
  const container = document.getElementById("sharedProfilesList");

  if (!shared.length) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  container.innerHTML = shared.map(s => `
    <div class="profile-card shared" onclick="openProfile('${s.profileId}', '${escHtml(s.profileName)}', 'editor', '${s.ownerId}')">
      <div class="profile-icon shared-icon">${escHtml(s.profileName.charAt(0).toUpperCase())}</div>
      <div class="profile-name">${escHtml(s.profileName)}</div>
      <div class="profile-owner">by ${escHtml(s.ownerName)}</div>
      <div class="profile-actions" onclick="event.stopPropagation()">
        <button class="btn-profile-action danger" onclick="leaveSharedProfile('${s.accessId}', '${escHtml(s.profileName)}')" title="Leave">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
  `).join("");
}

async function loadPendingInvites() {
  const q = query(
    collection(db, "invites"),
    where("invitedEmail", "==", currentUser.email),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  const invites = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const section = document.getElementById("invitesSection");
  const container = document.getElementById("pendingInvitesList");

  if (!invites.length) { section.style.display = "none"; return; }

  section.style.display = "block";
  container.innerHTML = invites.map(inv => `
    <div class="invite-card">
      <div class="invite-info">
        <strong>${escHtml(inv.profileName)}</strong>
        <span>shared by ${escHtml(inv.ownerName)}</span>
      </div>
      <div class="invite-btns">
        <button class="btn-accept" onclick="acceptInvite('${inv.id}', '${inv.profileId}', '${escHtml(inv.profileName)}', '${inv.ownerId}', '${escHtml(inv.ownerName)}')">Accept</button>
        <button class="btn-decline" onclick="declineInvite('${inv.id}')">Decline</button>
      </div>
    </div>
  `).join("");
}

/* ==========================
   Create / Delete Profile
========================== */

document.getElementById("btnNewProfile").addEventListener("click", () => {
  document.getElementById("newProfileName").value = "";
  document.getElementById("newProfileModal").style.display = "flex";
});

document.getElementById("btnCancelProfile").addEventListener("click", () => {
  document.getElementById("newProfileModal").style.display = "none";
});

document.getElementById("btnCreateProfile").addEventListener("click", async () => {
  const name = document.getElementById("newProfileName").value.trim();
  if (!name) { toast("Enter a profile name."); return; }

  await addDoc(collection(db, "users", currentUser.uid, "profiles"), {
    name,
    ownerId: currentUser.uid,
    createdAt: new Date().toISOString()
  });

  document.getElementById("newProfileModal").style.display = "none";
  toast("Profile created ✓");
  await loadMyProfiles();
});

window.deleteProfile = async function (profileId, profileName) {
  if (!confirm(`Delete profile "${profileName}" and all its readings? This cannot be undone.`)) return;

  // Delete all readings
  const readSnap = await getDocs(collection(db, "users", currentUser.uid, "profiles", profileId, "readings"));
  await Promise.all(readSnap.docs.map(d => deleteDoc(d.ref)));

  // Delete shared access records
  const accessSnap = await getDocs(query(collection(db, "sharedAccess"), where("profileId", "==", profileId)));
  await Promise.all(accessSnap.docs.map(d => deleteDoc(d.ref)));

  // Delete pending invites
  const invSnap = await getDocs(query(collection(db, "invites"), where("profileId", "==", profileId)));
  await Promise.all(invSnap.docs.map(d => deleteDoc(d.ref)));

  // Delete profile
  await deleteDoc(doc(db, "users", currentUser.uid, "profiles", profileId));

  toast("Profile deleted");
  await loadMyProfiles();
};

/* ==========================
   Open Profile → App
========================== */

window.openProfile = function (profileId, profileName, role, ownerId) {
  currentProfile = {
    id: profileId,
    name: profileName,
    role,
    ownerId: ownerId || currentUser.uid
  };

  document.getElementById("appProfileName").textContent = profileName;
  document.getElementById("appProfileRole").textContent = role === "owner" ? "Owner" : "Editor (shared)";

  // Hide share button for editors
  document.getElementById("btnShareProfile").style.display = role === "owner" ? "inline-flex" : "none";

  showScreen("app");
  setDefaultTime();
  render();
};

/* ==========================
   Invite Modal
========================== */

window.openInviteModal = async function (profileId, profileName) {
  currentProfile = { id: profileId, name: profileName, role: "owner", ownerId: currentUser.uid };
  document.getElementById("inviteEmail").value = "";
  document.getElementById("inviteModal").style.display = "flex";
  await loadCurrentEditors(profileId);
};

document.getElementById("btnShareProfile").addEventListener("click", () => {
  if (currentProfile) openInviteModal(currentProfile.id, currentProfile.name);
});

document.getElementById("btnCancelInvite").addEventListener("click", () => {
  document.getElementById("inviteModal").style.display = "none";
});

document.getElementById("btnSendInvite").addEventListener("click", async () => {
  const email = document.getElementById("inviteEmail").value.trim().toLowerCase();
  if (!email) { toast("Enter an email address."); return; }
  if (email === currentUser.email.toLowerCase()) { toast("You can't invite yourself."); return; }

  // Check for duplicate invite — query only by ownerId (allowed by rules)
  const q = query(
    collection(db, "invites"),
    where("ownerId", "==", currentUser.uid),
    where("profileId", "==", currentProfile.id)
  );
  const existing = await getDocs(q);
  const alreadyInvited = existing.docs.some(d => d.data().invitedEmail === email && d.data().status === "pending");
  if (alreadyInvited) { toast("Invite already sent to this email."); return; }

  // Check already has access — use predictable doc ID directly
  const accessDocId = `${currentUser.uid}_${currentProfile.id}_${currentUser.uid}`;
  // Instead just check invite list above covers duplicates; skip separate access query

  await addDoc(collection(db, "invites"), {
    profileId: currentProfile.id,
    profileName: currentProfile.name,
    ownerId: currentUser.uid,
    ownerName: currentUser.displayName || currentUser.email,
    invitedEmail: email,
    status: "pending",
    createdAt: new Date().toISOString()
  });

  document.getElementById("inviteEmail").value = "";
  toast("Invite sent ✓");
  await loadCurrentEditors(currentProfile.id);
});

async function loadCurrentEditors(profileId) {
  // Query sharedAccess by ownerId — allowed by rules
  const q = query(collection(db, "sharedAccess"), where("ownerId", "==", currentUser.uid));
  const snap = await getDocs(q);
  const editors = snap.docs
    .map(d => ({ accessId: d.id, ...d.data() }))
    .filter(d => d.profileId === profileId);

  // Query invites by ownerId — allowed by rules
  const pendingQ = query(
    collection(db, "invites"),
    where("ownerId", "==", currentUser.uid),
    where("profileId", "==", profileId),
    where("status", "==", "pending")
  );
  const pendingSnap = await getDocs(pendingQ);
  const pending = pendingSnap.docs.map(d => ({ inviteId: d.id, ...d.data() }));

  const container = document.getElementById("currentEditors");

  if (!editors.length && !pending.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="editors-title">People with access</div>
    ${editors.map(e => `
      <div class="editor-row">
        <span>${escHtml(e.editorEmail)}</span>
        <span class="editor-badge">Editor</span>
        <button class="btn-remove-editor" onclick="removeEditor('${e.accessId}', '${escHtml(e.editorEmail)}')">Remove</button>
      </div>
    `).join("")}
    ${pending.map(p => `
      <div class="editor-row">
        <span>${escHtml(p.invitedEmail)}</span>
        <span class="editor-badge pending">Pending</span>
        <button class="btn-remove-editor" onclick="cancelInvite('${p.inviteId}')">Cancel</button>
      </div>
    `).join("")}
  `;
}

window.removeEditor = async function (accessId, email) {
  if (!confirm(`Remove ${email}'s access?`)) return;
  await deleteDoc(doc(db, "sharedAccess", accessId));
  toast("Access removed");
  await loadCurrentEditors(currentProfile.id);
};

window.cancelInvite = async function (inviteId) {
  await deleteDoc(doc(db, "invites", inviteId));
  toast("Invite cancelled");
  await loadCurrentEditors(currentProfile.id);
};

/* ==========================
   Accept / Decline Invite
========================== */

window.acceptInvite = async function (inviteId, profileId, profileName, ownerId, ownerName) {
  // Use predictable doc ID: editorUid_profileId_ownerId — matches Firestore rules
  const accessDocId = `${currentUser.uid}_${profileId}_${ownerId}`;
  await setDoc(doc(db, "sharedAccess", accessDocId), {
    profileId,
    profileName,
    ownerId,
    ownerName,
    editorId: currentUser.uid,
    editorEmail: currentUser.email,
    createdAt: new Date().toISOString()
  });

  await updateDoc(doc(db, "invites", inviteId), { status: "accepted" });

  toast("Invite accepted ✓");
  await loadProfileScreen();
};

window.declineInvite = async function (inviteId) {
  await updateDoc(doc(db, "invites", inviteId), { status: "declined" });
  toast("Invite declined");
  await loadProfileScreen();
};

window.leaveSharedProfile = async function (accessId, profileName) {
  if (!confirm(`Leave "${profileName}"? You'll lose editor access.`)) return;
  await deleteDoc(doc(db, "sharedAccess", accessId));
  toast("Left shared profile");
  await loadProfileScreen();
};

/* ==========================
   Readings Ref
========================== */

function readingsRef() {
  return collection(db, "users", currentProfile.ownerId, "profiles", currentProfile.id, "readings");
}

/* ==========================
   Firestore Helpers
========================== */

async function loadReadings() {
  try {
    const q = query(readingsRef(), orderBy("time", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

async function saveReading(reading) {
  await addDoc(readingsRef(), reading);
}

async function removeReading(id) {
  await deleteDoc(doc(db, "users", currentProfile.ownerId, "profiles", currentProfile.id, "readings", id));
}

/* ==========================
   Helpers
========================== */

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function classify(sys, dia) {
  if (sys < 90 || dia < 60) return ["low", "Low"];
  if (sys < 120 && dia < 80) return ["normal", "Normal"];
  if (sys < 130 && dia < 80) return ["elevated", "Elevated"];
  return ["high", "High"];
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) + " " +
         d.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true });
}

function fmtDateShort(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { day:"2-digit", month:"short" });
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true });
}

function toast(message, duration = 2500) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), duration);
}

/* ==========================
   Main Render
========================== */

async function render() {
  const readings = await loadReadings();
  const sorted = [...readings].sort((a, b) => new Date(a.time) - new Date(b.time));
  updateStats(sorted);
  updateChart(sorted);
  updateTable(readings);
}

/* ==========================
   Statistics
========================== */

function updateStats(readings) {
  if (!readings.length) {
    document.getElementById("avgSys").textContent = "—";
    document.getElementById("avgDia").textContent = "—";
    document.getElementById("latestReading").textContent = "—";
    document.getElementById("latestDate").textContent = "No readings yet";
    document.getElementById("totalReadings").textContent = "0";
    return;
  }
  const avgSys = Math.round(readings.reduce((s, r) => s + r.sys, 0) / readings.length);
  const avgDia = Math.round(readings.reduce((s, r) => s + r.dia, 0) / readings.length);
  const latest = readings[readings.length - 1];
  document.getElementById("avgSys").textContent = avgSys;
  document.getElementById("avgDia").textContent = avgDia;
  document.getElementById("latestReading").textContent = `${latest.sys}/${latest.dia}`;
  document.getElementById("latestDate").textContent = fmtDate(latest.time);
  document.getElementById("totalReadings").textContent = readings.length;
}

/* ==========================
   Chart.js
========================== */

function updateChart(readings) {
  const ctx = document.getElementById("bpChart").getContext("2d");
  if (chart) chart.destroy();
  if (!readings.length) return;
  const isMobile = window.innerWidth <= 600;
  const labels = readings.map(r => isMobile ? fmtDateShort(r.time) : `${fmtDateShort(r.time)}\n${fmtTime(r.time)}`);

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label:"Systolic", data:readings.map(r=>r.sys), borderColor:"#e24b4a", backgroundColor:"rgba(226,75,74,0.08)", borderWidth:2, pointBackgroundColor:"#e24b4a", pointRadius:isMobile?3:5, pointHoverRadius:6, fill:true, tension:0.35 },
        { label:"Diastolic", data:readings.map(r=>r.dia), borderColor:"#185fa5", backgroundColor:"rgba(24,95,165,0.08)", borderWidth:2, pointBackgroundColor:"#185fa5", pointRadius:isMobile?3:5, pointHoverRadius:6, fill:true, tension:0.35, borderDash:[5,3] }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction:{ mode:"index", intersect:false },
      plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ title:ctx=>ctx[0].label.replace("\n"," · "), label:ctx=>`${ctx.dataset.label}: ${ctx.parsed.y} mmHg` } } },
      scales:{ x:{ ticks:{ maxTicksLimit:isMobile?7:15, autoSkip:true } }, y:{ min:40, max:250, ticks:{ stepSize:isMobile?40:20 } } }
    }
  });
}

/* ==========================
   Default Date-Time
========================== */

function setDefaultTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById("readingTime").value = now.toISOString().slice(0, 16);
}

/* ==========================
   Reading History Table
========================== */

function updateTable(all) {
  const container = document.getElementById("tableContainer");
  const sorted = [...all].sort((a, b) => new Date(b.time) - new Date(a.time));

  if (!sorted.length) {
    container.innerHTML = `<div class="empty-state"><p>No readings yet. Add your first reading above.</p></div>`;
    return;
  }

  const desktopRows = sorted.map(r => `
    <tr>
      <td>${fmtDate(r.time)}</td>
      <td class="sv">${r.sys}</td>
      <td class="dv">${r.dia}</td>
      <td>${r.pulse || "-"}</td>
      <td>${r.notes || "-"}</td>
      <td><button class="btn-del" onclick="deleteReading('${r.id}')">✕</button></td>
    </tr>`).join("");

  const mobileCards = sorted.map(r => `
    <div class="row-card">
      <div class="row-date">${fmtDate(r.time)}</div>
      <div class="row-bp"><span class="row-sys">${r.sys}</span> / <span class="row-dia">${r.dia}</span> mmHg</div>
      <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <span class="row-pulse">♥ ${r.pulse || "-"} bpm</span>
      </div>
      ${r.notes ? `<div class="row-notes">${r.notes}</div>` : ""}
      <button class="btn-del" style="margin-top:8px;" onclick="deleteReading('${r.id}')">Delete</button>
    </div>`).join("");

  container.innerHTML = `
    <table class="tbl-desktop">
      <thead><tr><th>Date & Time</th><th>Systolic</th><th>Diastolic</th><th>Pulse</th><th>Notes</th><th></th></tr></thead>
      <tbody>${desktopRows}</tbody>
    </table>
    <div class="tbl-mobile">${mobileCards}</div>`;
}

/* ==========================
   Add Reading
========================== */

window.addReading = async function () {
  const sys = parseInt(document.getElementById("systolic").value);
  const dia = parseInt(document.getElementById("diastolic").value);
  const pulseText = document.getElementById("pulse").value.trim();
  const pulse = pulseText ? parseInt(pulseText) : "";
  const notes = document.getElementById("notes").value.trim();
  const timeValue = document.getElementById("readingTime").value;

  if (!sys || !dia) { toast("Enter systolic and diastolic."); return; }
  if (sys < 60 || sys > 250) { toast("Systolic must be 60–250."); return; }
  if (dia < 40 || dia > 150) { toast("Diastolic must be 40–150."); return; }
  if (dia >= sys) { toast("Systolic must be greater."); return; }
  if (pulse !== "" && (pulse < 30 || pulse > 220)) { toast("Pulse must be 30–220."); return; }

  const time = timeValue ? new Date(timeValue).toISOString() : new Date().toISOString();
  await saveReading({ sys, dia, pulse, time, notes });

  document.getElementById("systolic").value = "";
  document.getElementById("diastolic").value = "";
  document.getElementById("pulse").value = "";
  document.getElementById("notes").value = "";
  setDefaultTime();
  await render();
  toast("Reading saved ✓");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

/* ==========================
   Delete Reading
========================== */

window.deleteReading = async function (id) {
  if (!confirm("Delete reading?")) return;
  await removeReading(id);
  await render();
  toast("Reading deleted");
};

/* ==========================
   CSV Export
========================== */

window.downloadCSV = async function () {
  const all = await loadReadings();
  if (!all.length) { toast("No data found."); return; }

  const header = ["Date","Time","Systolic","Diastolic","Pulse Pressure","Pulse","Status","Notes"];
  const rows = all.map(r => {
    const d = new Date(r.time);
    const [, status] = classify(r.sys, r.dia);
    return [d.toLocaleDateString("en-IN"), d.toLocaleTimeString("en-IN"), r.sys, r.dia, r.sys-r.dia, r.pulse||"-", status, r.notes||"-"].join(",");
  });

  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bp_${currentProfile.name}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast("CSV downloaded ✓");
};

/* ==========================
   CSV Import
========================== */

function parseTime(timeStr) {
  const parts = timeStr.trim().split(' ');
  const time = parts[0];
  const meridian = (parts[1] || '').toLowerCase();
  let [hour, minute, second] = time.split(':').map(Number);
  if (meridian === 'pm' && hour < 12) hour += 12;
  if (meridian === 'am' && hour === 12) hour = 0;
  return [hour ?? 0, minute ?? 0, second ?? 0];
}

window.importCSV = async function (event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    const text = e.target.result;
    const lines = text.trim().split("\n");
    if (lines.length <= 1) { toast("CSV is empty."); return; }

    const existing = await loadReadings();
    const existingKeys = new Set(existing.map(r => `${r.time}_${r.sys}_${r.dia}`));

    let imported = 0, skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].replace(/\r$/, "").split(",");
      if (cols.length < 8) continue;

      const [date, time, sys, dia, , pulse, , notes] = cols;
      const [day, month, year] = date.split("/");
      const iso = new Date(parseInt(year), parseInt(month)-1, parseInt(day), ...parseTime(time)).toISOString();
      const key = `${iso}_${sys}_${dia}`;

      if (existingKeys.has(key)) { skipped++; continue; }

      await saveReading({
        sys: parseInt(sys), dia: parseInt(dia),
        pulse: pulse === "-" ? "" : pulse.trim(),
        time: iso, notes: (notes || "").trim()
      });

      existingKeys.add(key);
      imported++;
    }

    await render();
    toast(`Imported ${imported}, skipped ${skipped}`);
  };

  reader.readAsText(file);
  event.target.value = "";
};

/* ==========================
   Events
========================== */

document.addEventListener("keydown", e => { if (e.key === "Enter") window.addReading(); });

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(async () => {
    if (!currentProfile) return;
    const readings = await loadReadings();
    updateChart([...readings].sort((a,b) => new Date(a.time)-new Date(b.time)));
  }, 200);
});