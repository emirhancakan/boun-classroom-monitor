# BOUN Classroom Monitor

Find an empty classroom at Boğaziçi University right now, or see any room's
weekly schedule.

No build step and no dependencies: just open `index.html`. The interface is
in English and Turkish (EN / TR in the header).

## Features

**Available Classrooms**

- Shows which classrooms are free in the current class hour, using Istanbul
  time wherever you are.
- Step through the week with the previous/next hour buttons. **Now** jumps back
  to the current hour.
- **Free for 1 / 2 / 3 hours** shows only rooms free for that many consecutive
  hours.
- Each room says how long it stays free: "until 14:00" or "rest of the day".
- **Show rooms in use** also lists booked rooms, with the course in each and
  when the room frees up.
- Filter by building. Click any room to open its weekly schedule.

**Room Schedule**

- Find a room by typing part of its name (`nh101`, `NH 101` and `101` all
  work), or pick a building and then a room.
- See the room's weekly timetable, with the current hour outlined and a status
  line ("Free now, until 14:00" / "In use now: …").
- Search courses by code, name or instructor to see when and where they meet.
  Rooms in the results are clickable.
- A room's page has its own link (`#room=NH%20101`), so you can share it.

## Room rules

These live in `rooms.js`:

- Rooms are grouped into buildings by their leading letters, e.g. `NH` in
  `NH 101` or `VYKM` in `VYKM 1`.
- Hisar Campus blocks (`HA`–`HE`) count as one building.
- `MAXWELL` and `MULTI` rooms belong to Kare Blok.
- BME rooms are recognised, but that building is hidden from the pickers.
- Labs (any room with "LAB" in its name) and `M 3160` are never listed as free
  classrooms. They still have a room schedule.
- Room names are normalized: `kp 315` → `KP 315`, `VYKM1` → `VYKM 1`, and
  `NH 405,NH 405` counts as one room.

## Running it

Open `index.html` in a browser. The data is loaded with `<script src>` instead
of `fetch()`, so this works from `file://` without a web server. To serve it
anyway:

```bash
python -m http.server 8420
```

To check a particular moment, add `?now=YYYY-MM-DDTHH:MM` (Istanbul time) to
the URL, e.g. `index.html?now=2026-10-08T10:15`.

## Data and automated updates

The data comes from the same scraper as
[course-planner](https://github.com/emirhancakan/course-planner). It reads the
registrar's public schedule pages, with no login.

The GitHub Actions workflow (`.github/workflows/update-courses.yml`) runs
**daily at 03:00 UTC / 06:00 Istanbul**:

- It scrapes the newest semester.
- It commits only when course content actually changed. The commit message
  lists what was added, removed or rescheduled.
- If any department fails to fetch, or the data fails its integrity checks,
  nothing is published.

To run it on demand: **Actions → Update course data → Run workflow**. Leave the
semester box blank for the newest term, or type one like `2025/2026-2`.
Running it for an older semester adds that semester to the dropdown.

To scrape by hand:

```bash
pip install -r scraper/requirements.txt
python scraper/scrape_boun.py "2026/2027-1"   # a specific semester
python scraper/scrape_boun.py                 # newest semester
```

| File | Purpose |
| --- | --- |
| `data/courses-<semester>.json` | Full dataset |
| `data/courses-<semester>.js` | Same data, loadable from `file://` |
| `data/manifest.json` / `manifest.js` | List of available semesters |
| `data/departments.json` | Cached department list |

## Hosting

The site is plain static files, served by GitHub Pages from the `main` branch
(**Settings → Pages → Deploy from a branch → main / root**).

> GitHub turns off scheduled workflows in public repos after 60 days with no
> repository activity. If updates go quiet for a whole term, re-enable the
> workflow from the Actions tab.

## Disclaimer

This site has no affiliation with Boğaziçi University. Unannounced room
reservations do not show up here. Always check
[BOUN Registration](https://registration.boun.edu.tr) for the official schedule.
