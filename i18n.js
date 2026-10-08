/*
 * Interface strings in English and Turkish. Exposes window.I18n.
 *
 * Values are plain strings with {placeholders}, or functions when the wording
 * depends on a number. Course names, instructors and room names come from the
 * registrar and are shown as-is in both languages.
 */
(function () {
  "use strict";

  const STRINGS = {
    en: {
      title: "Classroom Monitor",
      semester: "Semester",
      language: "Language",
      modeAvailable: "Available Classrooms",
      modeSchedule: "Room Schedule",
      disclaimerShort: "Unannounced room reservations may not be reflected here.",
      istanbulTime: "Istanbul",

      building: "Building",
      allBuildings: "All buildings",
      selectBuilding: "Select a building…",
      room: "Room",
      selectRoom: "Select a room…",
      selectBuildingFirst: "Select a building first",

      timeSlot: "Time slot",
      prevHour: "Previous hour",
      nextHour: "Next hour",
      now: "Now",
      nowBadge: "now",
      consecutive: "Free for",
      slotsLabel: n => n === 1 ? "1 hour" : `${n} hours`,
      showBusy: "Show rooms in use",

      noClassesSunday: "Sunday: no classes are scheduled.",
      outsideHours: "Outside class hours ({start}–{end}).",
      lookAhead: "Use “Next hour” to look ahead.",
      weekendNote: "It's the weekend: buildings may be locked even when rooms are free.",
      exceedsHours: n => `A ${n}-hour block from this start time runs past the last class hour. Pick an earlier time or fewer hours.`,
      freeCount: n => n === 1 ? "1 free" : `${n} free`,
      busyCount: n => `${n} in use`,
      totalFree: n => n === 1 ? "<strong>1</strong> classroom is free" : `<strong>${n}</strong> classrooms are free`,
      noneFree: "No free classrooms found.",
      freeUntil: "until {time}",
      freeRestOfDay: "rest of the day",
      busyUntil: "until {time}",
      busyFrom: "from {time}",
      inUse: "In use",
      openSchedule: "Open the weekly schedule of {room}",

      findRoom: "Find a room",
      findRoomPlaceholder: "Room number, e.g. NH 101",
      noRoomMatches: "No rooms match.",
      courseSearch: "Find a course",
      courseSearchPlaceholder: "Course code, name or instructor (e.g. CMPE 150)",
      courseSearchHint: n => `Search ${n.toLocaleString("en")} sections to see where they meet.`,
      noMatches: "No matches.",
      moreMatches: n => `Showing the first ${n} matches. Refine the search for more.`,
      noMeetingTime: "No fixed meeting time",
      tba: "TBA",

      weeklySchedule: "Weekly schedule",
      pickRoomPrompt: "Pick a room on the left, or click a room anywhere on the page, to see its week.",
      roomEmpty: "No classes are scheduled in this room this semester.",
      statusFreeUntil: "Free now, until {time}",
      statusFreeRest: "Free now for the rest of the day",
      statusBusy: "In use now: {course} · room booked until {time}",
      statusOutside: "No class hour right now",
      roomNotInSemester: "{room} has no classes in {semester}.",

      loadFailed: "Could not load the data for {semester}.",
      noData: "No course data found. Run the scraper first.",

      footerLuck: "🍀 Good luck this semester!",
      footerText: "This site has no affiliation with Boğaziçi University. Check <a href=\"https://registration.boun.edu.tr\" target=\"_blank\" rel=\"noopener\">BOUN Registration</a> for the most up-to-date schedule and classroom details. The information here may lag behind the registration website.",
      dataUpdated: "Data updated {date}",

      days: { M: "Mon", T: "Tue", W: "Wed", Th: "Thu", F: "Fri", S: "Sat", Su: "Sun" },
      daysLong: { M: "Monday", T: "Tuesday", W: "Wednesday", Th: "Thursday", F: "Friday", S: "Saturday", Su: "Sunday" },
    },

    tr: {
      title: "Derslik Takip",
      semester: "Dönem",
      language: "Dil",
      modeAvailable: "Boş Derslikler",
      modeSchedule: "Derslik Programı",
      disclaimerShort: "Önceden duyurulmayan rezervasyonlar burada görünmeyebilir.",
      istanbulTime: "İstanbul",

      building: "Bina",
      allBuildings: "Tüm binalar",
      selectBuilding: "Bina seçin…",
      room: "Derslik",
      selectRoom: "Derslik seçin…",
      selectBuildingFirst: "Önce bina seçin",

      timeSlot: "Saat",
      prevHour: "Önceki saat",
      nextHour: "Sonraki saat",
      now: "Şimdi",
      nowBadge: "şimdi",
      consecutive: "Boş kalma süresi",
      slotsLabel: n => `${n} saat`,
      showBusy: "Dolu derslikleri göster",

      noClassesSunday: "Pazar: planlanmış ders yok.",
      outsideHours: "Ders saatleri dışında ({start}–{end}).",
      lookAhead: "İleriye bakmak için “Sonraki saat”i kullanın.",
      weekendNote: "Hafta sonu: derslikler boş olsa da binalar kilitli olabilir.",
      exceedsHours: n => `Bu başlangıçtan itibaren ${n} saatlik blok son ders saatini aşıyor. Daha erken bir saat ya da daha kısa bir süre seçin.`,
      freeCount: n => `${n} boş`,
      busyCount: n => `${n} dolu`,
      totalFree: n => `<strong>${n}</strong> derslik boş`,
      noneFree: "Boş derslik bulunamadı.",
      freeUntil: "{timeDat} kadar",
      freeRestOfDay: "gün sonuna kadar",
      busyUntil: "{timeDat} kadar",
      busyFrom: "{time} itibarıyla",
      inUse: "Dolu",
      openSchedule: "{room} haftalık programını aç",

      findRoom: "Derslik ara",
      findRoomPlaceholder: "Derslik numarası, ör. NH 101",
      noRoomMatches: "Eşleşen derslik yok.",
      courseSearch: "Ders ara",
      courseSearchPlaceholder: "Ders kodu, adı veya öğretim üyesi (ör. CMPE 150)",
      courseSearchHint: n => `Nerede yapıldığını görmek için ${n.toLocaleString("tr")} şube arasında arayın.`,
      noMatches: "Sonuç yok.",
      moreMatches: n => `İlk ${n} sonuç gösteriliyor. Daha fazlası için aramayı daraltın.`,
      noMeetingTime: "Sabit ders saati yok",
      tba: "Belirsiz",

      weeklySchedule: "Haftalık program",
      pickRoomPrompt: "Haftalık programını görmek için soldan bir derslik seçin ya da sayfadaki herhangi bir dersliğe tıklayın.",
      roomEmpty: "Bu dönem bu derslikte planlanmış ders yok.",
      statusFreeUntil: "Şu an boş, {timeDat} kadar",
      statusFreeRest: "Şu an boş, gün sonuna kadar",
      statusBusy: "Şu an dolu: {course} · derslik {timeDat} kadar dolu",
      statusOutside: "Şu an ders saati değil",
      roomNotInSemester: "{room} dersliğinde {semester} döneminde ders yok.",

      loadFailed: "{semester} verisi yüklenemedi.",
      noData: "Ders verisi bulunamadı. Önce veri toplayıcıyı çalıştırın.",

      footerLuck: "🍀 Yeni dönemde başarılar!",
      footerText: "Bu sitenin Boğaziçi Üniversitesi ile bir bağlantısı yoktur. En güncel ders ve derslik bilgileri için <a href=\"https://registration.boun.edu.tr\" target=\"_blank\" rel=\"noopener\">BOUN Registration</a> sayfasına bakın. Buradaki bilgiler kayıt sitesinin gerisinde kalabilir.",
      dataUpdated: "Veri güncellemesi: {date}",

      days: { M: "Pzt", T: "Sal", W: "Çar", Th: "Per", F: "Cum", S: "Cmt", Su: "Paz" },
      daysLong: { M: "Pazartesi", T: "Salı", W: "Çarşamba", Th: "Perşembe", F: "Cuma", S: "Cumartesi", Su: "Pazar" },
    },
  };

  const LANGS = Object.keys(STRINGS);
  const STORAGE_KEY = "monitorLang";

  function initialLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (LANGS.includes(saved)) return saved;
    } catch (e) { /* storage blocked: fall through */ }
    return /^tr\b/i.test(navigator.language || "") ? "tr" : "en";
  }

  let lang = initialLang();

  /* Turkish attaches the dative to the spoken number, so "14:00" (on dört)
     takes 'e but "16:00" (on altı) takes 'ya and "11:50" (elli) takes 'ye.
     Only the last spoken word matters: the minutes, or the hour on the hour. */
  const TR_UNITS = ["", "e", "ye", "e", "e", "e", "ya", "ye", "e", "a"];
  const TR_TENS = ["a", "a", "ye", "a", "a", "ye"];

  function trDative(time) {
    const [h, m] = time.split(":").map(Number);
    const n = m ? m : h;
    const suffix = n % 10 ? TR_UNITS[n % 10] : TR_TENS[Math.floor(n / 10)];
    return `${time}'${suffix}`;
  }

  /* t("freeUntil", { time: "14:00" }) or t("freeCount", 3). A `time` argument
     also provides {timeDat}, its Turkish dative form. */
  function t(key, arg) {
    if (arg && typeof arg === "object" && arg.time) arg = Object.assign({ timeDat: trDative(arg.time) }, arg);
    const value = STRINGS[lang][key] !== undefined ? STRINGS[lang][key] : STRINGS.en[key];
    if (typeof value === "function") return value(arg);
    if (typeof value !== "string" || !arg || typeof arg !== "object") return value;
    return value.replace(/\{(\w+)\}/g, (m, name) => (name in arg ? arg[name] : m));
  }

  function setLang(next) {
    if (!LANGS.includes(next)) return;
    lang = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* not fatal */ }
  }

  window.I18n = { t, setLang, lang: () => lang, LANGS };
})();
