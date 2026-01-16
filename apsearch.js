/* search.js
   Autocomplete + chips for #depIn and #arrIn using ./airports.json
   Works with many common airport JSON schemas.
*/

(() => {
  const JSON_URL = "./airports.json";
  const MAX_RESULTS = 8;

  const depIn = document.getElementById("depIn");
  const arrIn = document.getElementById("arrIn");
  const depChips = document.getElementById("depChips");
  const arrChips = document.getElementById("arrChips");

  if (!depIn || !arrIn) return;

  // ---- Minimal styles injected (so you don't have to edit styles.css) ----
  const style = document.createElement("style");
  style.textContent = `
    .ac-panel{
      position: absolute; z-index: 9999;
      width: min(560px, calc(100vw - 24px));
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 18px 60px rgba(0,0,0,.18);
      padding: 8px;
      overflow: hidden;
      border: 1px solid rgba(0,0,0,.06);
    }
    .ac-item{
      display:flex; gap:12px;
      padding: 12px 12px;
      border-radius: 12px;
      cursor: pointer;
      align-items: center;
      user-select: none;
    }
    .ac-item:hover, .ac-item.is-active{ background: rgba(0,0,0,.06); }
    .ac-ico{
      width: 28px; height: 28px;
      display:flex; align-items:center; justify-content:center;
      opacity: .75;
      font-size: 16px;
      flex: 0 0 28px;
    }
    .ac-main{ flex: 1 1 auto; min-width: 0; }
    .ac-line1{
      font-weight: 700;
      font-size: 16px;
      line-height: 1.2;
      color: #0b2239;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ac-line2{
      margin-top: 2px;
      font-size: 13px;
      color: rgba(11,34,57,.72);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ac-code{
      font-weight: 800;
      color: rgba(11,34,57,.75);
      padding-left: 10px;
      flex: 0 0 auto;
    }
    .chip{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding: 8px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,.65);
      border: 1px solid rgba(0,0,0,.10);
      margin: 0 8px 8px 0;
      font-weight: 700;
      color: #0b2239;
      cursor: default;
    }
    .chip button{
      all: unset;
      cursor: pointer;
      opacity: .7;
      font-weight: 900;
      padding: 0 4px;
    }
    .chip button:hover{ opacity: 1; }
  `;
  document.head.appendChild(style);

  // ---- Helpers to normalize different JSON airport schemas ----
  const pick = (obj, keys) => {
    for (const k of keys) {
      if (obj && obj[k] != null && String(obj[k]).trim() !== "") return obj[k];
    }
    return "";
  };

  const norm = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  function toAirport(raw) {
    const iata = String(pick(raw, ["iata", "IATA", "iata_code", "iataCode", "code"])).toUpperCase().trim();
    const icao = String(pick(raw, ["icao", "ICAO", "icao_code", "icaoCode"])).toUpperCase().trim();

    // name / city / country appear under many keys in common datasets
    const name = String(pick(raw, ["name", "airport", "airportName", "airport_name"])).trim();
    const city = String(pick(raw, ["city", "municipality", "servedCity", "served_city", "locality"])).trim();
    const region = String(pick(raw, ["state", "region", "province", "subdivision", "iso_region"])).trim();
    const country = String(pick(raw, ["country", "countryName", "iso_country", "nation"])).trim();

    // Some files use "type" to mark large_airport, small_airport, etc.
    const type = String(pick(raw, ["type", "kind"])).trim();

    // If no IATA, ignore (Skyscanner-style lists are usually IATA-centric)
    if (!iata || iata.length !== 3) return null;

    // Build display strings
    const locBits = [city || name, region].filter(Boolean).join(", ").trim();
    const line1 = `${(name || city || iata)}${locBits && name ? `, ${region}` : ""}`.replace(/\s+,/g, ",");
    const line2 = [country].filter(Boolean).join(" ");

    const searchText = norm(
      [
        iata,
        icao,
        name,
        city,
        region,
        country,
        type
      ].filter(Boolean).join(" ")
    );

    return {
      iata,
      icao,
      name,
      city,
      region,
      country,
      type,
      line1: prettyLine1(raw, { iata, name, city, region }),
      line2: prettyLine2(raw, { country }),
      searchText
    };
  }

  function prettyLine1(_raw, a) {
    // Aim for: "Miami International, FL (MIA)" feel
    const left = (a.name || a.city || "").trim();
    const region = (a.region || "").trim();
    const base = [left, region].filter(Boolean).join(", ").trim();
    return base ? `${base} (${a.iata})` : `(${a.iata})`;
  }

  function prettyLine2(_raw, a) {
    return (a.country || "").trim();
  }

  // ---- Dropdown UI ----
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  panel.style.display = "none";
  document.body.appendChild(panel);

  let airports = [];
  let activeInput = null;
  let activeChipsEl = null;
  let activeItems = [];
  let activeIndex = -1;

  function positionPanel(inputEl) {
    const r = inputEl.getBoundingClientRect();
    panel.style.left = `${Math.max(12, r.left + window.scrollX)}px`;
    panel.style.top = `${r.bottom + 10 + window.scrollY}px`;
    panel.style.width = `${Math.min(560, r.width)}px`;
  }

  function closePanel() {
    panel.style.display = "none";
    panel.innerHTML = "";
    activeItems = [];
    activeIndex = -1;
  }

  function openPanel(inputEl) {
    activeInput = inputEl;
    activeChipsEl = inputEl === depIn ? depChips : arrChips;
    positionPanel(inputEl);
    panel.style.display = "block";
  }

  function setActive(idx) {
    activeIndex = idx;
    [...panel.querySelectorAll(".ac-item")].forEach((el, i) => {
      el.classList.toggle("is-active", i === idx);
    });
  }

  // ---- Chips ----
  function currentChipSet(chipsEl) {
    const set = new Set();
    chipsEl?.querySelectorAll(".chip")?.forEach((c) => set.add(c.dataset.code));
    return set;
  }

  function addChip(chipsEl, code) {
    const c = String(code || "").toUpperCase().trim();
    if (!c) return;
    const set = currentChipSet(chipsEl);
    if (set.has(c)) return;

    const chip = document.createElement("span");
    chip.className = "chip";
    chip.dataset.code = c;
    chip.innerHTML = `<span>${c}</span><button type="button" aria-label="Remove ${c}">×</button>`;
    chip.querySelector("button").addEventListener("click", () => chip.remove());
    chipsEl.appendChild(chip);
  }

  function parseMultiInputValue(v) {
    // If user types "JFK, BOS" we take the last fragment for searching
    const parts = String(v || "").split(",");
    return norm(parts[parts.length - 1]);
  }

  function commitSelection(a) {
    // Add chip and clear
    addChip(activeChipsEl, a.iata);
    activeInput.value = "";
    closePanel();
    activeInput.focus();
  }

  // ---- Search / scoring ----
  function scoreAirport(q, a) {
    // Higher is better
    const tq = q.trim();
    if (!tq) return -1;

    const iata = a.iata.toLowerCase();
    const txt = a.searchText;

    // Strong boosts for code matches
    if (iata === tq) return 1000;
    if (iata.startsWith(tq)) return 900;

    // Then city/name starts-with
    const city = norm(a.city);
    const name = norm(a.name);
    if (city && city.startsWith(tq)) return 700;
    if (name && name.startsWith(tq)) return 650;

    // Contains anywhere
    if (txt.includes(tq)) return 400 - Math.min(200, txt.indexOf(tq));

    return -1;
  }

  function searchAirports(query, chipsEl) {
    const q = norm(query);
    if (!q) return [];

    const already = currentChipSet(chipsEl);
    const scored = [];

    for (const a of airports) {
      if (already.has(a.iata)) continue;
      const s = scoreAirport(q, a);
      if (s > 0) scored.push([s, a]);
    }

    scored.sort((x, y) => y[0] - x[0]);
    return scored.slice(0, MAX_RESULTS).map((x) => x[1]);
  }

  function renderResults(items) {
    panel.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "ac-item";
      empty.style.cursor = "default";
      empty.innerHTML = `
        <div class="ac-ico">🔎</div>
        <div class="ac-main">
          <div class="ac-line1">No matches</div>
          <div class="ac-line2">Try a city, airport name, or IATA code</div>
        </div>
      `;
      panel.appendChild(empty);
      activeItems = [];
      activeIndex = -1;
      return;
    }

    activeItems = items;
    items.forEach((a, i) => {
      const row = document.createElement("div");
      row.className = "ac-item";
      row.innerHTML = `
        <div class="ac-ico">✈️</div>
        <div class="ac-main">
          <div class="ac-line1">${escapeHtml(a.line1)}</div>
          <div class="ac-line2">${escapeHtml(a.line2)}</div>
        </div>
        <div class="ac-code">${escapeHtml(a.iata)}</div>
      `;
      row.addEventListener("mouseenter", () => setActive(i));
      row.addEventListener("mousedown", (e) => {
        // mousedown so it fires before input blur
        e.preventDefault();
        commitSelection(a);
      });
      panel.appendChild(row);
    });

    setActive(0);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ---- Input wiring ----
  function attachAutocomplete(inputEl) {
    const chipsEl = inputEl === depIn ? depChips : arrChips;

    inputEl.addEventListener("focus", () => {
      openPanel(inputEl);
      const q = parseMultiInputValue(inputEl.value);
      renderResults(searchAirports(q, chipsEl));
    });

    inputEl.addEventListener("input", () => {
      openPanel(inputEl);
      positionPanel(inputEl);
      const q = parseMultiInputValue(inputEl.value);
      renderResults(searchAirports(q, chipsEl));
    });

    inputEl.addEventListener("keydown", (e) => {
      const isOpen = panel.style.display !== "none";
      const q = parseMultiInputValue(inputEl.value);

      if (e.key === "Escape") {
        closePanel();
        return;
      }

      // Enter behavior:
      // - if dropdown open + active item -> pick it
      // - else if user typed 3-letter code -> add chip
      if (e.key === "Enter") {
        e.preventDefault();

        if (isOpen && activeItems.length && activeIndex >= 0) {
          commitSelection(activeItems[activeIndex]);
          return;
        }

        const maybe = String(inputEl.value || "").trim().toUpperCase();
        // Allow adding plain IATA codes manually
        if (/^[A-Z]{3}$/.test(maybe)) {
          addChip(chipsEl, maybe);
          inputEl.value = "";
          closePanel();
        } else {
          // Try search with what they typed and select top match
          const results = searchAirports(q, chipsEl);
          if (results[0]) commitSelection(results[0]);
        }
        return;
      }

      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!activeItems.length) return;
        setActive(Math.min(activeItems.length - 1, activeIndex + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!activeItems.length) return;
        setActive(Math.max(0, activeIndex - 1));
      }
    });

    inputEl.addEventListener("blur", () => {
      // Delay so click selection (mousedown) can happen
      setTimeout(() => {
        if (document.activeElement !== inputEl) closePanel();
      }, 120);
    });
  }

  // Close when clicking elsewhere
  document.addEventListener("mousedown", (e) => {
    if (panel.contains(e.target)) return;
    if (e.target === depIn || e.target === arrIn) return;
    closePanel();
  });

  window.addEventListener("scroll", () => {
    if (panel.style.display === "none" || !activeInput) return;
    positionPanel(activeInput);
  }, true);

  window.addEventListener("resize", () => {
    if (panel.style.display === "none" || !activeInput) return;
    positionPanel(activeInput);
  });

  // ---- Load airports.json and initialize ----
  async function loadAirports() {
    const res = await fetch(JSON_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${JSON_URL} (${res.status})`);
    const data = await res.json();

    const arr =
      Array.isArray(data) ? data :
      Array.isArray(data.airports) ? data.airports :
      Array.isArray(data.data) ? data.data :
      [];

    const out = [];
    for (const raw of arr) {
      const a = toAirport(raw);
      if (a) out.push(a);
    }
    return out;
  }

  (async () => {
    try {
      airports = await loadAirports();
      attachAutocomplete(depIn);
      attachAutocomplete(arrIn);
    } catch (err) {
      console.error(err);
      // Fail silently in UI; you can also show a status message if you want
    }
  })();
})();
