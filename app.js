(function () {
  "use strict";

  const { t } = window.I18n;
  const Rooms = window.Rooms;

  // The week as the registrar schedules it. Sunday never has classes.
  const DAY_ORDER = ["M", "T", "W", "Th", "F", "S"];
  const WEEKDAY_TO_CODE = { Sun: "Su", Mon: "M", Tue: "T", Wed: "W", Thu: "Th", Fri: "F", Sat: "S" };
  const MAX_COURSE_RESULTS = 100;
  const MAX_ROOM_MATCHES = 30;
  const CLOCK_TICK_MS = 15000;
  // Registrar placeholders that are not rooms.
  const NOT_A_ROOM = new Set(["", "N/A", "TBA", "LAB", "-"]);

  // Spread hues far apart so neighbouring courses read as distinct colours.
  const COURSE_HUES = [210, 350, 150, 35, 275, 95, 190, 320, 60, 250, 130, 5];

  function courseColor(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    const hue = COURSE_HUES[hash % COURSE_HUES.length];
    return { bg: `hsl(${hue} 75% 50% / 0.24)`, border: `hsl(${hue} 70% 45%)` };
  }

  const el = {
    semesterSelect: document.getElementById("semesterSelect"),
    clock: document.getElementById("clock"),
    modeButtons: document.querySelectorAll(".mode-btn"),
    langButtons: document.querySelectorAll(".lang-btn"),
    availableView: document.getElementById("availableView"),
    scheduleView: document.getElementById("scheduleView"),
    availBuildingSelect: document.getElementById("availBuildingSelect"),
    prevHour: document.getElementById("prevHour"),
    nextHour: document.getElementById("nextHour"),
    nowBtn: document.getElementById("nowBtn"),
    timeBig: document.getElementById("timeBig"),
    timeDetail: document.getElementById("timeDetail"),
    slotButtons: document.getElementById("slotButtons"),
    showBusy: document.getElementById("showBusy"),
    availableResults: document.getElementById("availableResults"),
    roomSearch: document.getElementById("roomSearch"),
    roomMatches: document.getElementById("roomMatches"),
    buildingSelect: document.getElementById("buildingSelect"),
    roomSelect: document.getElementById("roomSelect"),
    courseSearch: document.getElementById("courseSearch"),
    courseResults: document.getElementById("courseResults"),
    scheduleHead: document.getElementById("scheduleHead"),
    grid: document.getElementById("grid"),
    dataUpdated: document.getElementById("dataUpdated"),
  };

  /* ----------------------------------------------------------------------
     State
     ---------------------------------------------------------------------- */
  let mode = "available";
  let currentSemester = null;
  let currentData = null;     // { semester, generatedAt, slotTimes, sections }
  let slots = [];             // slot numbers in order, e.g. [1..14]
  let roomIndex = new Map();  // room name -> { name, building, occ }
  let selectedRoom = null;    // room name shown in Room Schedule
  let viewPos = null;         // null = follow the clock; else an index into the week
  let stackedSlots = 1;       // how many consecutive free hours are required
  let lastNowKey = "";        // detects the clock moving into a new slot

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* not fatal */ }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  /* ----------------------------------------------------------------------
     Time. Class hours are Istanbul wall-clock time, whatever the viewer's own
     time zone. `?now=2026-10-08T10:15` pins the clock, for checking a given
     moment.
     ---------------------------------------------------------------------- */
  const pinnedNow = (function () {
    const m = /[?&]now=(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(location.search);
    if (!m) return null;
    const weekday = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
    return { day: ["Su", "M", "T", "W", "Th", "F", "S"][weekday], hour: +m[4], minute: +m[5] };
  })();

  const istanbulFormat = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });

  function istanbulNow() {
    if (pinnedNow) return pinnedNow;
    const parts = {};
    for (const p of istanbulFormat.formatToParts(new Date())) parts[p.type] = p.value;
    return { day: WEEKDAY_TO_CODE[parts.weekday], hour: Number(parts.hour) % 24, minute: Number(parts.minute) };
  }

  const pad2 = n => String(n).padStart(2, "0");
  const slotStart = s => currentData.slotTimes[String(s)].start;
  const slotEnd = s => currentData.slotTimes[String(s)].end;
  const slotHour = s => Number(slotStart(s).slice(0, 2));
  const weekLength = () => DAY_ORDER.length * slots.length;
  const wrap = p => ((p % weekLength()) + weekLength()) % weekLength();

  function posToDaySlot(p) {
    return { day: DAY_ORDER[Math.floor(p / slots.length)], slotIndex: p % slots.length };
  }

  /* Where "now" sits in the week. exact: inside a class hour, at index p.
     Otherwise p is the next class hour to come. */
  function nowPosition() {
    const now = istanbulNow();
    const di = DAY_ORDER.indexOf(now.day);
    if (di === -1) return { now, exact: false, p: 0 };            // Sunday -> Monday
    const si = slots.findIndex(s => slotHour(s) === now.hour);
    if (si !== -1) return { now, exact: true, p: di * slots.length + si };
    if (now.hour < slotHour(slots[0])) return { now, exact: false, p: di * slots.length };
    return { now, exact: false, p: wrap((di + 1) * slots.length) };
  }

  /* ----------------------------------------------------------------------
     Data
     ---------------------------------------------------------------------- */
  function ensureDataset(semester) {
    if (window.COURSE_DATASETS && window.COURSE_DATASETS[semester]) {
      return Promise.resolve(window.COURSE_DATASETS[semester]);
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "data/courses-" + semester.split("/").join("-") + ".js";
      script.onload = () => resolve(window.COURSE_DATASETS[semester]);
      script.onerror = () => reject(new Error(t("loadFailed", { semester })));
      document.body.appendChild(script);
    });
  }

  function sectionKey(s) { return s.code + "." + s.section; }
  // The registrar spaces codes irregularly ("CE  101", "HIST321"); show them
  // all as "HIST 321.01".
  function sectionLabel(s) {
    return s.code.replace(/\s+/g, "").replace(/^(\D+)(\d)/, "$1 $2") + "." + s.section;
  }

  /* room name -> { name, building, occ: { day: { slot: [{ section, meeting }] } } } */
  function buildRoomIndex(data) {
    const index = new Map();
    for (const section of data.sections) {
      for (const meeting of section.meetings) {
        for (const name of Rooms.splitRooms(meeting.room)) {
          if (NOT_A_ROOM.has(name) || !/[A-ZÇĞİÖŞÜ]/.test(name)) continue;
          let room = index.get(name);
          if (!room) {
            room = { name, building: Rooms.buildingFor(name), occ: {} };
            index.set(name, room);
          }
          const day = room.occ[meeting.day] || (room.occ[meeting.day] = {});
          const entries = day[meeting.slot] || (day[meeting.slot] = []);
          // A section listed twice for the same hour is still one booking.
          if (!entries.some(e => e.section === section)) entries.push({ section, meeting });
        }
      }
    }
    return index;
  }

  function entriesAt(room, day, slot) {
    return (room.occ[day] && room.occ[day][slot]) || [];
  }

  function roomsOf(building) {
    const list = [];
    for (const room of roomIndex.values()) if (room.building === building) list.push(room);
    return list.sort((a, b) => Rooms.compareRooms(a.name, b.name));
  }

  /* First slot index at or after `fromIndex` where the room is booked, or -1. */
  function nextBusyIndex(room, day, fromIndex) {
    for (let i = fromIndex; i < slots.length; i++) {
      if (entriesAt(room, day, slots[i]).length) return i;
    }
    return -1;
  }

  /* Last slot index of the booked run starting at `fromIndex`. */
  function busyRunEnd(room, day, fromIndex) {
    let i = fromIndex;
    while (i + 1 < slots.length && entriesAt(room, day, slots[i + 1]).length) i++;
    return i;
  }

  /* ----------------------------------------------------------------------
     Header: semester, mode, language, clock
     ---------------------------------------------------------------------- */
  function populateSemesters() {
    const semesters = window.AVAILABLE_SEMESTERS || [];
    el.semesterSelect.innerHTML = semesters
      .map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  }

  function setMode(next, { updateHash = true } = {}) {
    mode = next;
    storageSet("monitorMode", mode);
    el.availableView.hidden = mode !== "available";
    el.scheduleView.hidden = mode !== "schedule";
    el.modeButtons.forEach(b => {
      const active = b.dataset.mode === mode;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
    });
    if (updateHash) writeHash();
    renderCurrentView();
  }

  function renderClock() {
    const now = istanbulNow();
    el.clock.textContent = `${t("istanbulTime")} · ${t("days")[now.day]} ${pad2(now.hour)}:${pad2(now.minute)}`;
  }

  function applyStaticText() {
    document.documentElement.lang = window.I18n.lang();
    document.title = "BOUN " + t("title");
    document.querySelectorAll("[data-i18n]").forEach(n => { n.textContent = t(n.dataset.i18n); });
    document.querySelectorAll("[data-i18n-html]").forEach(n => { n.innerHTML = t(n.dataset.i18nHtml); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(n => { n.placeholder = t(n.dataset.i18nPlaceholder); });
    document.querySelectorAll("[data-i18n-title]").forEach(n => {
      n.title = t(n.dataset.i18nTitle);
      n.setAttribute("aria-label", n.title);
    });
    el.langButtons.forEach(b => b.classList.toggle("active", b.dataset.lang === window.I18n.lang()));
    el.slotButtons.querySelectorAll("button").forEach(b => { b.textContent = t("slotsLabel", Number(b.dataset.slots)); });
  }

  function populateBuildingSelects() {
    const lang = window.I18n.lang();
    const withRooms = Rooms.visibleBuildings().filter(b => roomsOf(b).length);
    const options = withRooms
      .map(b => `<option value="${escapeHtml(b.code)}">${escapeHtml(b.code)} — ${escapeHtml(b.name[lang])}</option>`)
      .join("");

    const availPrev = el.availBuildingSelect.value || storageGet("monitorAvailBuilding") || "";
    el.availBuildingSelect.innerHTML = `<option value="">${escapeHtml(t("allBuildings"))}</option>` + options;
    el.availBuildingSelect.value = withRooms.some(b => b.code === availPrev) ? availPrev : "";

    const schedPrev = el.buildingSelect.value;
    el.buildingSelect.innerHTML = `<option value="">${escapeHtml(t("selectBuilding"))}</option>` + options;
    el.buildingSelect.value = withRooms.some(b => b.code === schedPrev) ? schedPrev : "";
  }

  function renderDataUpdated() {
    const stamp = currentData && currentData.generatedAt;
    el.dataUpdated.textContent = stamp ? t("dataUpdated", { date: stamp.slice(0, 10) }) : "";
  }

  /* ----------------------------------------------------------------------
     Available Classrooms
     ---------------------------------------------------------------------- */
  function renderAvailable() {
    const nowPos = nowPosition();
    const following = viewPos === null;
    el.slotButtons.querySelectorAll("button").forEach(b => {
      b.classList.toggle("active", Number(b.dataset.slots) === stackedSlots);
    });
    el.nowBtn.disabled = following;

    if (following && !nowPos.exact) {
      el.timeBig.textContent = `${t("daysLong")[nowPos.now.day]} · ${pad2(nowPos.now.hour)}:${pad2(nowPos.now.minute)}`;
      const reason = nowPos.now.day === "Su"
        ? t("noClassesSunday")
        : t("outsideHours", { start: slotStart(slots[0]), end: slotEnd(slots[slots.length - 1]) });
      el.timeDetail.textContent = "";
      el.availableResults.innerHTML = `<div class="message">${escapeHtml(reason)} ${escapeHtml(t("lookAhead"))}</div>`;
      return;
    }

    const p = following ? nowPos.p : viewPos;
    const { day, slotIndex } = posToDaySlot(p);
    const lastIndex = slotIndex + stackedSlots - 1;
    const endTime = slotEnd(slots[Math.min(lastIndex, slots.length - 1)]);
    el.timeBig.innerHTML = `${escapeHtml(t("daysLong")[day])} · ${slotStart(slots[slotIndex])}–${endTime}` +
      (following ? ` <span class="now-badge">${escapeHtml(t("nowBadge"))}</span>` : "");
    el.timeDetail.textContent = day === "S" ? t("weekendNote") : "";

    if (lastIndex >= slots.length) {
      el.availableResults.innerHTML = `<div class="message">${escapeHtml(t("exceedsHours", stackedSlots))}</div>`;
      return;
    }

    const lang = window.I18n.lang();
    const showBusy = el.showBusy.checked;
    const code = el.availBuildingSelect.value;
    const buildings = Rooms.visibleBuildings().filter(b => !code || b.code === code);

    let totalFree = 0;
    let html = "";
    for (const b of buildings) {
      const free = [];
      const busy = [];
      for (const room of roomsOf(b)) {
        if (Rooms.isExcludedFromAvailable(room.name)) continue;
        const busyIndex = nextBusyIndex(room, day, slotIndex);
        if (busyIndex === -1 || busyIndex > lastIndex) free.push({ room, busyIndex });
        else busy.push({ room, busyIndex });
      }
      if (!free.length && !(showBusy && busy.length)) continue;
      totalFree += free.length;

      const freeChips = free.map(({ room, busyIndex }) => {
        const until = busyIndex === -1 ? t("freeRestOfDay") : t("freeUntil", { time: slotStart(slots[busyIndex]) });
        return roomChip(room.name, [until], "free");
      }).join("");

      const busyChips = showBusy ? busy.map(({ room, busyIndex }) => {
        const courses = entriesAt(room, day, slots[busyIndex]).map(e => sectionLabel(e.section)).join(", ");
        const when = busyIndex === slotIndex
          ? t("busyUntil", { time: slotEnd(slots[busyRunEnd(room, day, busyIndex)]) })
          : t("busyFrom", { time: slotStart(slots[busyIndex]) });
        return roomChip(room.name, [courses, when], "busy");
      }).join("") : "";

      html += `
        <section class="panel building-card">
          <div class="building-head">
            <h2><span class="b-code">${escapeHtml(b.code)}</span> ${escapeHtml(b.name[lang])}</h2>
            <span class="pill pill-free">${escapeHtml(t("freeCount", free.length))}</span>
            ${showBusy && busy.length ? `<span class="pill pill-busy">${escapeHtml(t("busyCount", busy.length))}</span>` : ""}
          </div>
          ${free.length ? `<div class="chip-grid">${freeChips}</div>` : ""}
          ${busyChips ? `<div class="busy-label">${escapeHtml(t("inUse"))}</div><div class="chip-grid">${busyChips}</div>` : ""}
        </section>`;
    }

    const summary = totalFree
      ? `<div class="summary-line">${t("totalFree", totalFree)}</div>`
      : `<div class="message">${escapeHtml(t("noneFree"))}</div>`;
    el.availableResults.innerHTML = summary + html;
  }

  function roomChip(name, details, kind) {
    return `<button type="button" class="room-chip ${kind}" data-room="${escapeHtml(name)}"
              title="${escapeHtml(t("openSchedule", { room: name }))}">
        <span class="chip-name">${escapeHtml(name)}</span>
        ${details.map(d => `<span class="chip-detail">${escapeHtml(d)}</span>`).join("")}
      </button>`;
  }

  function stepTime(delta) {
    const nowPos = nowPosition();
    let base;
    if (viewPos !== null) base = viewPos + delta;
    else if (nowPos.exact) base = nowPos.p + delta;
    // Off-hours: "next" is the upcoming class hour itself, "previous" the one before it.
    else base = delta > 0 ? nowPos.p + delta - 1 : nowPos.p + delta;
    viewPos = wrap(base);
    // Landing back on the current hour resumes following the clock.
    if (nowPos.exact && viewPos === nowPos.p) viewPos = null;
    renderAvailable();
  }

  /* ----------------------------------------------------------------------
     Room Schedule
     ---------------------------------------------------------------------- */
  function populateRoomSelect() {
    const code = el.buildingSelect.value;
    const building = Rooms.BUILDINGS.find(b => b.code === code);
    if (!building) {
      el.roomSelect.innerHTML = `<option value="">${escapeHtml(t("selectBuildingFirst"))}</option>`;
      el.roomSelect.disabled = true;
      return;
    }
    el.roomSelect.innerHTML = `<option value="">${escapeHtml(t("selectRoom"))}</option>` +
      roomsOf(building).map(r => `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`).join("");
    el.roomSelect.disabled = false;
    el.roomSelect.value = selectedRoom && roomIndex.has(selectedRoom) ? selectedRoom : "";
  }

  function openRoom(name) {
    selectedRoom = name;
    const room = roomIndex.get(name);
    if (room && room.building && !room.building.hidden) el.buildingSelect.value = room.building.code;
    populateRoomSelect();
    if (mode !== "schedule") setMode("schedule");
    else { writeHash(); renderSchedule(); }
    window.scrollTo({ top: 0 });
  }

  function renderRoomMatches() {
    const query = el.roomSearch.value.trim();
    if (!query) { el.roomMatches.innerHTML = ""; return; }
    const key = Rooms.searchKey(query);
    const matches = [...roomIndex.keys()]
      .filter(name => Rooms.searchKey(name).includes(key))
      .sort(Rooms.compareRooms);
    if (!matches.length) {
      el.roomMatches.innerHTML = `<div class="empty-note">${escapeHtml(t("noRoomMatches"))}</div>`;
      return;
    }
    el.roomMatches.innerHTML = matches.slice(0, MAX_ROOM_MATCHES)
      .map(name => `<button type="button" class="room-link${name === selectedRoom ? " current" : ""}" data-room="${escapeHtml(name)}">${escapeHtml(name)}</button>`)
      .join("") + (matches.length > MAX_ROOM_MATCHES ? ` <span class="empty-note">…</span>` : "");
  }

  function renderScheduleHead(room) {
    if (!selectedRoom) {
      el.scheduleHead.innerHTML = `<div class="empty-note">${escapeHtml(t("pickRoomPrompt"))}</div>`;
      return;
    }
    if (!room) {
      el.scheduleHead.innerHTML = `<h2>${escapeHtml(selectedRoom)}</h2>
        <div class="empty-note">${escapeHtml(t("roomNotInSemester", { room: selectedRoom, semester: currentSemester }))}</div>`;
      return;
    }

    const nowPos = nowPosition();
    let status;
    let statusClass = "status-free";
    if (!nowPos.exact) {
      status = t("statusOutside");
      statusClass = "status-off";
    } else {
      const { day, slotIndex } = posToDaySlot(nowPos.p);
      const here = entriesAt(room, day, slots[slotIndex]);
      if (here.length) {
        status = t("statusBusy", {
          course: here.map(e => `${sectionLabel(e.section)} ${e.section.name}`).join(", "),
          time: slotEnd(slots[busyRunEnd(room, day, slotIndex)]),
        });
        statusClass = "status-busy";
      } else {
        const busyIndex = nextBusyIndex(room, day, slotIndex);
        status = busyIndex === -1 ? t("statusFreeRest") : t("statusFreeUntil", { time: slotStart(slots[busyIndex]) });
      }
    }

    const lang = window.I18n.lang();
    const buildingName = room.building ? `${room.building.code} — ${room.building.name[lang]}` : "";
    el.scheduleHead.innerHTML = `
      <div class="room-title">
        <h2>${escapeHtml(room.name)}</h2>
        ${buildingName ? `<span class="room-building">${escapeHtml(buildingName)}</span>` : ""}
      </div>
      <div class="room-status ${statusClass}">${escapeHtml(status)}</div>`;
  }

  function renderSchedule() {
    const room = selectedRoom ? roomIndex.get(selectedRoom) : null;
    renderScheduleHead(room);
    renderRoomMatches();

    if (!room) { el.grid.innerHTML = ""; syncLayout(); return; }

    const hasBookings = Object.keys(room.occ).length > 0;
    // Saturday only earns a column when this room is used on Saturdays.
    const days = DAY_ORDER.filter(d => d !== "S" || room.occ.S);
    const nowPos = nowPosition();
    const nowCell = nowPos.exact ? posToDaySlot(nowPos.p) : null;

    // With table-layout:fixed the column widths come from the first row, so
    // the hour column's width is set on its header cell.
    let html = '<thead><tr><th class="time-col"></th>' +
      days.map(d => `<th>${escapeHtml(t("days")[d])}</th>`).join("") + "</tr></thead><tbody>";

    slots.forEach((slot, si) => {
      html += `<tr><td class="time-col">${slotStart(slot)}</td>`;
      for (const day of days) {
        const isNow = nowCell && nowCell.day === day && nowCell.slotIndex === si;
        const entries = entriesAt(room, day, slot);
        const blocks = entries.map(({ section, meeting }) => {
          const color = courseColor(section.code);
          const type = meetingTypeLabel(meeting.type);
          return `
            <div class="cell-block" style="background:${color.bg}; border-left-color:${color.border};"
                 title="${escapeHtml(sectionLabel(section) + " — " + section.name + (meeting.instructor ? " — " + meeting.instructor : ""))}">
              <div class="cb-code">${escapeHtml(sectionLabel(section))}${type ? `<span class="cb-type">${escapeHtml(type)}</span>` : ""}</div>
              <div class="cb-sub">${escapeHtml(meeting.instructor || section.name)}</div>
            </div>`;
        }).join("");
        html += `<td${isNow ? ' class="now-cell"' : ""}><div class="cell-stack">${blocks}</div></td>`;
      }
      html += "</tr>";
    });
    html += "</tbody>";
    el.grid.innerHTML = html;

    if (!hasBookings) {
      el.scheduleHead.insertAdjacentHTML("beforeend", `<div class="empty-note">${escapeHtml(t("roomEmpty"))}</div>`);
    }
    syncLayout();
  }

  // "LECT" is the default and would be noise on every block; LAB and P.S. are
  // worth flagging.
  function meetingTypeLabel(type) {
    const tt = (type || "").trim();
    if (!tt || tt.toUpperCase() === "LECT") return "";
    return tt.replace(/\./g, "").toUpperCase();
  }

  /* --- course search ----------------------------------------------------- */

  /* Words a section can be found by: its code in a few spellings, its name
     and its instructors. Matched as word prefixes (see renderCourseResults). */
  function indexSection(s) {
    const compact = s.code.replace(/\s+/g, "").toLocaleLowerCase("tr-TR");
    const dept = (compact.match(/^[\p{L}]+/u) || [compact])[0];
    const words = [compact, dept, compact.slice(dept.length), compact + "." + s.section];
    const text = [s.name].concat(s.meetings.map(m => m.instructor)).join(" ");
    s.__words = words.filter(Boolean).concat(
      text.toLocaleLowerCase("tr-TR").split(/[^\p{L}\p{N}]+/u).filter(Boolean)
    );
  }

  function parseQuery(raw) {
    // A trailing space means the user finished that term, so it must match a
    // whole word ("ce " = CE only, not CET); otherwise it is a prefix.
    const parts = raw.toLocaleLowerCase("tr-TR").split(/\s+/);
    const endsWithSpace = parts[parts.length - 1] === "";
    const texts = parts.filter(p => /[\p{L}\p{N}]/u.test(p));
    return texts.map((text, i) => ({ text, exact: i < texts.length - 1 || endsWithSpace }));
  }

  /* Consecutive hours in the same room merge into one line: "Mon 09:00–11:50". */
  function groupMeetings(meetings) {
    const sorted = meetings.slice().sort((a, b) =>
      DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.slot - b.slot);
    const groups = [];
    for (const m of sorted) {
      const last = groups[groups.length - 1];
      if (last && last.day === m.day && last.room === m.room && last.type === m.type && last.to + 1 === m.slot) {
        last.to = m.slot;
      } else {
        groups.push({ day: m.day, from: m.slot, to: m.slot, room: m.room, type: m.type });
      }
    }
    return groups;
  }

  function renderCourseResults() {
    const raw = el.courseSearch.value;
    if (!currentData) return;
    if (!raw.trim()) {
      el.courseResults.innerHTML = `<div class="empty-note">${escapeHtml(t("courseSearchHint", currentData.sections.length))}</div>`;
      return;
    }
    const tokens = parseQuery(raw);
    const matches = [];
    if (tokens.length) {
      for (const s of currentData.sections) {
        const words = s.__words;
        const hit = tokens.every(tok => tok.exact
          ? words.some(w => w === tok.text)
          : words.some(w => w.startsWith(tok.text)));
        if (hit) {
          matches.push(s);
          if (matches.length >= MAX_COURSE_RESULTS) break;
        }
      }
    }
    if (!matches.length) {
      el.courseResults.innerHTML = `<div class="empty-note">${escapeHtml(t("noMatches"))}</div>`;
      return;
    }

    el.courseResults.innerHTML = matches.map(s => {
      const instructors = [...new Set(s.meetings.map(m => m.instructor).filter(Boolean))].join(", ");
      const lines = groupMeetings(s.meetings).map(g => {
        const rooms = Rooms.splitRooms(g.room);
        const roomHtml = rooms.length
          ? rooms.map(r => roomIndex.has(r)
              ? `<button type="button" class="room-link" data-room="${escapeHtml(r)}">${escapeHtml(r)}</button>`
              : escapeHtml(r)).join(" ")
          : escapeHtml(t("tba"));
        const type = meetingTypeLabel(g.type);
        return `<div class="meeting-line">
            <span class="ml-time">${escapeHtml(t("days")[g.day] || g.day)} ${slotStart(g.from)}–${slotEnd(g.to)}</span>
            ${roomHtml}${type ? ` <span class="cb-type">${escapeHtml(type)}</span>` : ""}
          </div>`;
      }).join("");
      return `
        <div class="result-card">
          <div class="rc-code">${escapeHtml(sectionLabel(s))}</div>
          <div class="rc-name">${escapeHtml(s.name)}${instructors ? " · " + escapeHtml(instructors) : ""}</div>
          <div class="rc-meta">${lines || escapeHtml(t("noMeetingTime"))}</div>
        </div>`;
    }).join("") + (matches.length >= MAX_COURSE_RESULTS
      ? `<div class="empty-note">${escapeHtml(t("moreMatches", MAX_COURSE_RESULTS))}</div>` : "");
  }

  /* ----------------------------------------------------------------------
     Rendering glue
     ---------------------------------------------------------------------- */
  function renderCurrentView() {
    if (!currentData) return;
    if (mode === "available") renderAvailable();
    else { renderSchedule(); renderCourseResults(); }
    syncLayout();
  }

  // The sticky day row of the timetable parks under the page header, whose
  // height changes as it wraps, so it is measured rather than hard-coded.
  function syncLayout() {
    const header = document.querySelector(".app-header");
    if (header) {
      const h = Math.round(header.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--header-h", h + "px");
    }
    if (window.ScrollViews) window.ScrollViews.refresh();
  }

  function writeHash() {
    const hash = mode === "schedule" && selectedRoom ? "#room=" + encodeURIComponent(selectedRoom) : "#" + mode;
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }

  function readHash() {
    const roomMatch = /^#room=(.+)$/.exec(location.hash);
    if (roomMatch) {
      try { return { mode: "schedule", room: Rooms.normalizeRoom(decodeURIComponent(roomMatch[1])) }; }
      catch (e) { return null; }
    }
    if (location.hash === "#schedule" || location.hash === "#available") return { mode: location.hash.slice(1) };
    return null;
  }

  function switchSemester(semester) {
    currentSemester = semester;
    storageSet("monitorLastSemester", semester);
    ensureDataset(semester).then(data => {
      currentData = data;
      slots = Object.keys(data.slotTimes).map(Number).sort((a, b) => a - b);
      data.sections.forEach(indexSection);
      roomIndex = buildRoomIndex(data);
      if (viewPos !== null) viewPos = wrap(viewPos);
      populateBuildingSelects();
      const room = selectedRoom && roomIndex.get(selectedRoom);
      if (room && room.building && !room.building.hidden) el.buildingSelect.value = room.building.code;
      populateRoomSelect();
      renderDataUpdated();
      lastNowKey = nowKey();
      renderCurrentView();
    }).catch(err => {
      el.availableResults.innerHTML = `<div class="message">${escapeHtml(err.message)}</div>`;
      el.courseResults.innerHTML = `<div class="empty-note">${escapeHtml(err.message)}</div>`;
    });
  }

  function nowKey() {
    if (!currentData) return "";
    const pos = nowPosition();
    return pos.exact + ":" + pos.p;
  }

  /* ----------------------------------------------------------------------
     Events
     ---------------------------------------------------------------------- */
  el.semesterSelect.addEventListener("change", () => switchSemester(el.semesterSelect.value));
  el.modeButtons.forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  el.langButtons.forEach(b => b.addEventListener("click", () => {
    window.I18n.setLang(b.dataset.lang);
    applyStaticText();
    renderClock();
    if (currentData) {
      populateBuildingSelects();
      populateRoomSelect();
      renderDataUpdated();
    }
    renderCurrentView();
  }));

  el.availBuildingSelect.addEventListener("change", () => {
    storageSet("monitorAvailBuilding", el.availBuildingSelect.value);
    renderAvailable();
  });
  el.prevHour.addEventListener("click", () => stepTime(-1));
  el.nextHour.addEventListener("click", () => stepTime(1));
  el.nowBtn.addEventListener("click", () => { viewPos = null; renderAvailable(); });
  el.slotButtons.addEventListener("click", e => {
    const btn = e.target.closest("button[data-slots]");
    if (!btn) return;
    stackedSlots = Number(btn.dataset.slots);
    renderAvailable();
  });
  el.showBusy.addEventListener("change", () => {
    storageSet("monitorShowBusy", el.showBusy.checked ? "1" : "0");
    renderAvailable();
  });

  el.buildingSelect.addEventListener("change", () => {
    populateRoomSelect();
  });
  el.roomSelect.addEventListener("change", () => {
    if (el.roomSelect.value) openRoom(el.roomSelect.value);
  });
  el.roomSearch.addEventListener("input", renderRoomMatches);
  el.roomSearch.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    const first = el.roomMatches.querySelector("[data-room]");
    if (first) openRoom(first.dataset.room);
  });
  el.courseSearch.addEventListener("input", () => { renderCourseResults(); syncLayout(); });

  // Any room name rendered as a button, anywhere, opens that room's week.
  document.addEventListener("click", e => {
    const target = e.target.closest("[data-room]");
    if (target) openRoom(target.dataset.room);
  });

  window.addEventListener("hashchange", () => {
    const h = readHash();
    if (!h) return;
    if (h.room) openRoom(h.room);
    else setMode(h.mode, { updateHash: false });
  });

  window.addEventListener("resize", syncLayout);
  window.addEventListener("load", syncLayout);

  // Keep the clock current, and redraw when it moves into a new class hour.
  setInterval(() => {
    renderClock();
    const key = nowKey();
    if (key !== lastNowKey) {
      lastNowKey = key;
      renderCurrentView();
    }
  }, CLOCK_TICK_MS);

  /* ----------------------------------------------------------------------
     Start
     ---------------------------------------------------------------------- */
  applyStaticText();
  renderClock();
  el.showBusy.checked = storageGet("monitorShowBusy") === "1";
  populateSemesters();

  const fromHash = readHash();
  if (fromHash && fromHash.room) selectedRoom = fromHash.room;
  const savedMode = storageGet("monitorMode");
  setMode(fromHash ? fromHash.mode : (savedMode === "schedule" ? "schedule" : "available"));

  const semesters = window.AVAILABLE_SEMESTERS || [];
  const lastUsed = storageGet("monitorLastSemester");
  const initial = lastUsed && semesters.includes(lastUsed) ? lastUsed : semesters[0];
  if (initial) {
    el.semesterSelect.value = initial;
    switchSemester(initial);
  } else {
    el.availableResults.innerHTML = `<div class="message">${escapeHtml(t("noData"))}</div>`;
  }
})();
