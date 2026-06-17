const STORAGE_KEY = "bp_readings_v1";
let chart = null;

/* ==========================
   Storage
========================== */

function loadReadings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveReadings(readings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(readings));
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
    d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) +
    " " +
    d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  );
}

function fmtDateShort(iso) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function toast(message, duration = 2500) {
  const el = document.getElementById("toast");

  el.textContent = message;
  el.classList.add("show");

  setTimeout(() => {
    el.classList.remove("show");
  }, duration);
}

function last30Days(readings) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

  return readings.filter((r) => new Date(r.time).getTime() >= cutoff);
}

/* ==========================
   Main Render
========================== */

function render() {
  const all = loadReadings();

  const readings = last30Days(all).sort(
    (a, b) => new Date(a.time) - new Date(b.time),
  );

  updateStats(readings);
  updateChart(readings);

  // Defined in Part 2
  updateTable(all);
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

  const avgSys = Math.round(
    readings.reduce((sum, r) => sum + r.sys, 0) / readings.length,
  );

  const avgDia = Math.round(
    readings.reduce((sum, r) => sum + r.dia, 0) / readings.length,
  );

  const latest = readings[readings.length - 1];

  document.getElementById("avgSys").textContent = avgSys;

  document.getElementById("avgDia").textContent = avgDia;

  document.getElementById("latestReading").textContent =
    `${latest.sys}/${latest.dia}`;

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
    isMobile
      ? fmtDateShort(r.time)
      : `${fmtDateShort(r.time)}\n${fmtTime(r.time)}`,
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

      interaction: {
        mode: "index",
        intersect: false,
      },

      plugins: {
        legend: {
          display: false,
        },

        tooltip: {
          callbacks: {
            title: (ctx) => ctx[0].label.replace("\n", " · "),

            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} mmHg`,
          },
        },
      },

      scales: {
        x: {
          ticks: {
            maxTicksLimit: isMobile ? 7 : 15,

            autoSkip: true,
          },
        },

        y: {
          min: 40,
          max: 250,

          ticks: {
            stepSize: isMobile ? 40 : 20,
          },
        },
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
        <p>
          No readings yet.
          Add your first reading above.
        </p>
      </div>
    `;

    return;
  }

  /* Desktop Table */

  const desktopRows = sorted
    .map((r) => {
      const idx = all.indexOf(r);

      return `
        <tr>

          <td>${fmtDate(r.time)}</td>

          <td class="sv">
            ${r.sys}
          </td>

          <td class="dv">
            ${r.dia}
          </td>

          <td>
            ${r.pulse || "-"}
          </td>

          <td>
            ${r.notes || "-"}
          </td>

          <td>
            <button
              class="btn-del"
              onclick="
                deleteReading(
                  ${idx}
                )
              ">
              ✕
            </button>
          </td>

        </tr>
      `;
    })
    .join("");

  /* Mobile Cards */

  const mobileCards = sorted
    .map((r) => {
      const idx = all.indexOf(r);

      return `
        <div class="row-card">

          <div class="row-date">
            ${fmtDate(r.time)}
          </div>

          <div class="row-bp">
            <span class="row-sys">
              ${r.sys}
            </span>
            /
            <span class="row-dia">
              ${r.dia}
            </span>
            mmHg
          </div>

          <div style="
            margin-top:8px;
            display:flex;
            justify-content:
              space-between;
            align-items:center;
            flex-wrap:wrap;
            gap:8px;
          ">

            <span class="row-pulse">
              ♥ ${r.pulse || "-"} bpm
            </span>

          </div>

          ${
            r.notes
              ? `<div class="row-notes">
                  ${r.notes}
                 </div>`
              : ""
          }

          <button
            class="btn-del"
            style="margin-top:8px;"
            onclick="
              deleteReading(
                ${idx}
              )
            ">
            Delete
          </button>

        </div>
      `;
    })
    .join("");

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

      <tbody>

        ${desktopRows}

      </tbody>

    </table>

    <div class="tbl-mobile">

      ${mobileCards}

    </div>

  `;
}

/* ==========================
   Add Reading
========================== */

function addReading() {
  const sys = parseInt(document.getElementById("systolic").value);

  const dia = parseInt(document.getElementById("diastolic").value);

  const pulseText = document.getElementById("pulse").value.trim();

  const pulse = pulseText ? parseInt(pulseText) : "";

  const notes = document.getElementById("notes").value.trim();

  const timeValue = document.getElementById("readingTime").value;

  if (!sys || !dia) {
    toast("Enter systolic and diastolic.");
    return;
  }

  if (sys < 60 || sys > 250) {
    toast("Systolic must be 60–250.");
    return;
  }

  if (dia < 40 || dia > 150) {
    toast("Diastolic must be 40–150.");
    return;
  }

  if (dia >= sys) {
    toast("Systolic must be greater.");
    return;
  }

  if (pulse !== "" && (pulse < 30 || pulse > 220)) {
    toast("Pulse must be 30–220.");
    return;
  }

  const time = timeValue
    ? new Date(timeValue).toISOString()
    : new Date().toISOString();

  const readings = loadReadings();

  readings.push({
    sys,
    dia,
    pulse,
    time,
    notes,
  });

  saveReadings(readings);

  document.getElementById("systolic").value = "";

  document.getElementById("diastolic").value = "";

  document.getElementById("pulse").value = "";

  document.getElementById("notes").value = "";

  setDefaultTime();

  render();

  toast("Reading saved ✓");

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

/* ==========================
   Delete Reading
========================== */

function deleteReading(index) {
  if (!confirm("Delete reading?")) return;

  const readings = loadReadings();

  readings.splice(index, 1);

  saveReadings(readings);

  render();

  toast("Reading deleted");
}

/* ==========================
   CSV Export
========================== */

function downloadCSV() {
  const all = loadReadings();

  if (!all.length) {
    toast("No data found.");

    return;
  }

  const header = [
    "Date",
    "Time",
    "Systolic",
    "Diastolic",
    "Pulse Pressure",
    "Pulse",
    "Status",
    "Notes",
  ];

  const rows = all.map((r) => {
    const d = new Date(r.time);

    const date = d.toLocaleDateString("en-IN");

    const time = d.toLocaleTimeString("en-IN");

    const [, status] = classify(r.sys, r.dia);

    return [
      date,
      time,
      r.sys,
      r.dia,
      r.sys - r.dia,
      r.pulse || "-",
      status,
      r.notes || "-",
    ].join(",");
  });

  const csv = [header.join(","), ...rows].join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;

  a.download = `bp_readings_${new Date().toISOString().slice(0, 10)}.csv`;

  a.click();

  URL.revokeObjectURL(url);

  toast("CSV downloaded ✓");
}

/*============================
    Helper function
============================*/
function parseTime(timeStr) {
  const parts = timeStr.trim().split(" ");
  const time = parts[0];
  const meridian = (parts[1] || "").toLowerCase();

  let [hour, minute, second] = time.split(":").map(Number);

  if (meridian === "pm" && hour < 12) hour += 12;
  if (meridian === "am" && hour === 12) hour = 0;

  return [hour ?? 0, minute ?? 0, second ?? 0]; // ?? instead of || to be safe for 0
}

/*==========================
   CSV Import
==========================*/
function importCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (e) {
    const text = e.target.result;
    const lines = text.trim().split("\n");

    if (lines.length <= 1) {
      toast("CSV is empty.");
      return;
    }

    const existing = loadReadings();

    // Seed the set with composite keys from existing readings
    const existingKeys = new Set(
      existing.map((r) => `${r.time}_${r.sys}_${r.dia}`),
    );

    let imported = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].replace(/\r$/, "").split(","); // strip \r for Windows CSVs

      if (cols.length < 8) continue;

      const [date, time, sys, dia, pulsePressure, pulse, status, notes] = cols;
      const [day, month, year] = date.split("/");

      const iso = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        ...parseTime(time),
      ).toISOString();

      // Check BEFORE pushing
      const key = `${iso}_${sys}_${dia}`;
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }

      existing.push({
        sys: parseInt(sys),
        dia: parseInt(dia),
        pulse: pulse === "-" ? "" : pulse.trim(),
        time: iso,
        notes: (notes || "").trim(),
      });

      existingKeys.add(key);
      imported++;
    }

    saveReadings(existing);
    render();
    toast(`Imported ${imported}, skipped ${skipped}`);
  };

  reader.readAsText(file);
  event.target.value = "";
}
/* ==========================
   Events
========================== */

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    addReading();
  }
});

let resizeTimer;

window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);

  resizeTimer = setTimeout(() => {
    const readings = last30Days(loadReadings()).sort(
      (a, b) => new Date(a.time) - new Date(b.time),
    );

    updateChart(readings);
  }, 200);
});

/* ==========================
   Init
========================== */

setDefaultTime();
render();
