/*
 * Buildings and the rules for turning the registrar's room strings into rooms.
 *
 * Exposes window.Rooms. Kept apart from app.js so the rules can be read (and
 * changed) without wading through rendering code.
 */
(function () {
  "use strict";

  // `prefixes` are the leading letters of a room name ("NH" in "NH 101",
  // "VYKM" in "VYKM1"). Hisar Campus spreads over several blocks, so it is
  // grouped as one building. BME rooms are recognised but the building is
  // hidden from the pickers, as it was in the original monitor.
  const BUILDINGS = [
    { code: "BM", prefixes: ["BM"],
      name: { en: "Computer Engineering Building", tr: "Bilgisayar Mühendisliği Binası" } },
    { code: "BME", prefixes: ["BME"], hidden: true,
      name: { en: "Institute of Biomedical Engineering", tr: "Biyomedikal Mühendisliği Enstitüsü" } },
    { code: "EF", prefixes: ["EF"],
      name: { en: "Faculty of Education", tr: "Eğitim Fakültesi" } },
    { code: "ET", prefixes: ["ET"],
      name: { en: "ETA-B Block", tr: "ETA-B Blok" } },
    { code: "GKM", prefixes: ["GKM"],
      name: { en: "Garanti Cultural Centre", tr: "Garanti Kültür Merkezi" } },
    { code: "HH", prefixes: ["HH"],
      name: { en: "Hamlin Hall (former Men's Dormitory)", tr: "Hamlin Hall (Eski Erkek Yurdu)" } },
    { code: "HISAR", prefixes: ["HA", "HB", "HC", "HD", "HE"],
      name: { en: "Hisar Campus", tr: "Hisar Kampüsü" } },
    { code: "İB", prefixes: ["İB", "IB"],
      name: { en: "Washburn Hall (Economics and Administrative Sciences)",
              tr: "Washburn Hall (İktisadi ve İdari Bilimler Fakültesi)" } },
    { code: "JF", prefixes: ["JF"],
      name: { en: "John Freely Hall", tr: "John Freely Binası" } },
    { code: "KB", prefixes: ["KB", "MAXWELL", "MULTI"],
      name: { en: "Science and Engineering Building (Kare Blok)", tr: "Kare Blok (Fen ve Mühendislik Binası)" } },
    { code: "KP", prefixes: ["KP"],
      name: { en: "North Park Building", tr: "Kuzey Park Binası" } },
    { code: "M", prefixes: ["M", "VYKM"],
      name: { en: "Perkins Hall (Faculty of Engineering)", tr: "Perkins Hall (Mühendislik Fakültesi)" } },
    { code: "NB", prefixes: ["NB"],
      name: { en: "Natuk Birkan Building", tr: "Natuk Birkan Binası" } },
    { code: "NH", prefixes: ["NH"],
      name: { en: "New Hall", tr: "New Hall" } },
    { code: "SH", prefixes: ["SH"],
      name: { en: "Sloane Hall (Psychology and Sociology)", tr: "Sloane Hall (Psikoloji ve Sosyoloji)" } },
    { code: "TB", prefixes: ["TB"],
      name: { en: "Anderson Hall (Arts and Sciences)", tr: "Anderson Hall (Fen-Edebiyat)" } },
    { code: "VB", prefixes: ["VB"],
      name: { en: "Institute for Data Science and Artificial Intelligence",
              tr: "Veri Bilimi ve Yapay Zekâ Enstitüsü" } },
  ];

  const BY_PREFIX = new Map();
  for (const b of BUILDINGS) for (const p of b.prefixes) BY_PREFIX.set(p, b);

  // Never offered as a free classroom: labs (by name) and the CAD lab, which
  // isn't named as one everywhere. They still have a room schedule.
  const EXCLUDED_ROOMS = new Set(["M 3160", "M 3160 CAD LAB"]);
  const LAB_ROOM_PATTERN = /\bLAB(?:ORATORY)?\b/;

  const LETTERS = "A-ZÇĞİÖŞÜ";
  const LEADING_LETTERS = new RegExp(`^[${LETTERS}]+`);
  const LETTERS_THEN_DIGIT = new RegExp(`^([${LETTERS}]+)(\\d.*)$`);

  /* Canonical form of one room name: upper case, single spaces, and a space
     between the building letters and the number ("VYKM1" -> "VYKM 1",
     "kp 315" -> "KP 315"). */
  function normalizeRoom(raw) {
    let room = String(raw || "").toLocaleUpperCase("tr-TR").replace(/\s+/g, " ").trim();
    room = room.replace(/\.+$/, "");
    const m = room.match(LETTERS_THEN_DIGIT);
    return m ? `${m[1]} ${m[2]}` : room;
  }

  /* A room cell can name several rooms ("NH 405,NH 405"); returns each one
     once, normalized. */
  function splitRooms(raw) {
    const out = [];
    for (const part of String(raw || "").split(/[,|]/)) {
      const room = normalizeRoom(part);
      if (room && !out.includes(room)) out.push(room);
    }
    return out;
  }

  /* Matches on the whole leading word, so "MİTHAT ALAM" is not mistaken for
     Perkins Hall ("M") the way a plain startsWith would. */
  function buildingFor(room) {
    const m = normalizeRoom(room).match(LEADING_LETTERS);
    return (m && BY_PREFIX.get(m[0])) || null;
  }

  function isExcludedFromAvailable(room) {
    const r = normalizeRoom(room);
    return LAB_ROOM_PATTERN.test(r) || EXCLUDED_ROOMS.has(r);
  }

  /* Compact key for searching: "nh101" finds "NH 101", and "IB" finds "İB"
     for anyone typing on a keyboard without Turkish letters. */
  function searchKey(room) {
    return normalizeRoom(room).replace(/[\s.\-()]/g, "").replace(/İ/g, "I");
  }

  function compareRooms(a, b) {
    return a.localeCompare(b, "tr", { numeric: true });
  }

  window.Rooms = {
    BUILDINGS,
    visibleBuildings: () => BUILDINGS.filter(b => !b.hidden),
    normalizeRoom,
    splitRooms,
    buildingFor,
    isExcludedFromAvailable,
    searchKey,
    compareRooms,
  };
})();
