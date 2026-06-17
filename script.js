import { loginWithGoogle, logoutUser, onAuthChange, db } from "./firebase.js";
import {
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  doc,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let chart = null;
let currentUser = null;

/* ==========================
   Auth
========================== */

document.getElementById("btnLogin").addEventListener("click", async () => {
  try {
    await loginWithGoogle();
  } catch (err) {
    toast("Sign-in failed. Please try again.");
  }
});

document.getElementById("btnLogout").addEventListener("click", async () => {
  await logoutUser();
  document.getElementById("appScreen").style.display = "none";
  document.getElementById("loginScreen").style.display = "flex";
});

onAuthChange((user) => {
  if (user) {
    currentUser = user;

    // Show app, hide login
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appScreen").style.display = "block";

    // Set user info in header
    document.getElementById("userName").textContent = user.displayName;
    const avatar = document.getElementById("userAvatar");
    if (user.photoURL) {
      avatar.src = user.photoURL;
      avatar.style.display = "inline-block";
    } else {
      avatar.style.display = "none";
    }

    setDefaultTime();
    render();
  } else {
    currentUser = null;
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("appScreen").style.display = "none";
  }
});

/* ==========================
   Firestore Helpers
========================== */

function userReadingsRef() {
  return collection(db, "users", currentUser.uid, "readings");
}

async function loadReadings() {
  try {
    const q = query(userReadingsRef(), orderBy("time", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

async function saveReading(reading) {
  await addDoc(userReadingsRef(), reading);
}

async function removeReading(id) {
  await deleteDoc(doc(db, "users", currentUser.uid, "readings", id));
}

/* ==========================
   Helpers
========================== */

function classify(sys, dia) {
  if (sys < 90 || dia < 60) return ["low", "Low"];
  if (sys < 120 && dia < 80) return ["normal", "Normal"];
  if (sys < 130 && dia < 80) return ["elevated", "Elevated"];
  return ["high", "High"];
}

function fmtDate(iso) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
  );
}

function fmtDateShort(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
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

  const avgSys = Math.round(readings.reduce((sum, r) => sum + r.sys, 0) / readings.length);
  const avgDia = Math.round(readings.reduce((sum, r) => sum + r.dia, 0) / readings.length);
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

  const labels = readings.map((r) =>
    isMobile ? fmtDateShort(r.time) : `${fmtDateShort(r.time)}\n${fmtTime(r.time)}`
  );

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Systolic",
          data: readings.map((r) => r.sys),
          borderColor: "#e24b4a",
          backgroundColor: "rgba(226,75,74,0.08)",
          borderWidth: 2,
          pointBackgroundColor: "#e24b4a",
          pointRadius: isMobile ? 3 : 5,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.35,
        },
        {
          label: "Diastolic",
          data: readings.map((r) => r.dia),
          borderColor: "#185fa5",
          backgroundColor: "rgba(24,95,165,0.08)",
          borderWidth: 2,
          pointBackgroundColor: "#185fa5",
          pointRadius: isMobile ? 3 : 5,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.35,
          borderDash: [5, 3],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (ctx) => ctx[0].label.replace("\n", " · "),
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} mmHg`,
          },
        },
      },
      scales: {
        x: { ticks: { maxTicksLimit: isMobile ? 7 : 15, autoSkip: true } },
        y: { min: 40, max: 250, ticks: { stepSize: isMobile ? 40 : 20 } },
      },
    },
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
   Reading History
========================== */

function updateTable(all) {
  const container = document.getElementById("tableContainer");
  const sorted = [...all].sort((a, b) => new Date(b.time) - new Date(a.time));

  if (!sorted.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No readings yet. Add your first reading above.</p>
      </div>`;
    return;
  }

  const desktopRows = sorted.map((r) => `
    <tr>
      <td>${fmtDate(r.time)}</td>
      <td class="sv">${r.sys}</td>
      <td class="dv">${r.dia}</td>
      <td>${r.pulse || "-"}</td>
      <td>${r.notes || "-"}</td>
      <td>
        <button class="btn-del" onclick="deleteReading('${r.id}')">✕</button>
      </td>
    </tr>`).join("");

  const mobileCards = sorted.map((r) => `
    <div class="row-card">
      <div class="row-date">${fmtDate(r.time)}</div>
      <div class="row-bp">
        <span class="row-sys">${r.sys}</span> /
        <span class="row-dia">${r.dia}</span> mmHg
      </div>
      <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <span class="row-pulse">♥ ${r.pulse || "-"} bpm</span>
      </div>
      ${r.notes ? `<div class="row-notes">${r.notes}</div>` : ""}
      <button class="btn-del" style="margin-top:8px;" onclick="deleteReading('${r.id}')">Delete</button>
    </div>`).join("");

  container.innerHTML = `
    <table class="tbl-desktop">
      <thead>
        <tr>
          <th>Date & Time</th>
          <th>Systolic</th>
          <th>Diastolic</th>
          <th>Pulse</th>
          <th>Notes</th>
          <th></th>
        </tr>
      </thead>
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

  const header = ["Date", "Time", "Systolic", "Diastolic", "Pulse Pressure", "Pulse", "Status", "Notes"];

  const rows = all.map((r) => {
    const d = new Date(r.time);
    const [, status] = classify(r.sys, r.dia);
    return [
      d.toLocaleDateString("en-IN"),
      d.toLocaleTimeString("en-IN"),
      r.sys, r.dia,
      r.sys - r.dia,
      r.pulse || "-",
      status,
      r.notes || "-",
    ].join(",");
  });

  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bp_readings_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast("CSV downloaded ✓");
};

/* ==========================
   Helper function
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

/* ==========================
   CSV Import
========================== */

window.importCSV = async function (event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async function (e) {
    const text = e.target.result;
    const lines = text.trim().split("\n");

    if (lines.length <= 1) { toast("CSV is empty."); return; }

    const existing = await loadReadings();
    const existingKeys = new Set(existing.map((r) => `${r.time}_${r.sys}_${r.dia}`));

    let imported = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].replace(/\r$/, "").split(",");
      if (cols.length < 8) continue;

      const [date, time, sys, dia, pulsePressure, pulse, status, notes] = cols;
      const [day, month, year] = date.split("/");

      const iso = new Date(
        parseInt(year), parseInt(month) - 1, parseInt(day), ...parseTime(time)
      ).toISOString();

      const key = `${iso}_${sys}_${dia}`;
      if (existingKeys.has(key)) { skipped++; continue; }

      await saveReading({
        sys: parseInt(sys),
        dia: parseInt(dia),
        pulse: pulse === "-" ? "" : pulse.trim(),
        time: iso,
        notes: (notes || "").trim(),
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

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") window.addReading();
});

let resizeTimer;
window.addEventListener("resize", async () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(async () => {
    const readings = await loadReadings();
    const sorted = [...readings].sort((a, b) => new Date(a.time) - new Date(b.time));
    updateChart(sorted);
  }, 200);
});
