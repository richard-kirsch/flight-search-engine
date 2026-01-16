document.addEventListener("DOMContentLoaded", () => {
  const depIn = document.getElementById("depIn"), arrIn = document.getElementById("arrIn");
  const depChips = document.getElementById("depChips"), arrChips = document.getElementById("arrChips");
  if (!depIn || !arrIn || !depChips || !arrChips) return;

  let A = [], items = [], idx = 0, activeIn = null, activeChips = null;

  const box = document.createElement("div");
  box.style.position = "absolute";
  box.style.display = "none";
  box.style.background = "white";
  box.style.border = "1px solid #ccc";
  box.style.zIndex = "99999";
  document.body.appendChild(box);

  const pick = (o, ks) => { for (const k of ks) if (o && o[k]) return o[k]; return ""; };
  const toA = o => {
    const iata = (pick(o, ["iata","IATA","iata_code","iataCode","code"]) || "").toString().toUpperCase().trim();
    if (iata.length !== 3) return null;
    const name = pick(o, ["name","airport","airport_name","airportName"]);
    const city = pick(o, ["city","municipality"]);
    const country = pick(o, ["country","iso_country","countryName"]);
    return { iata, label: `${name || city || iata} (${iata})${country ? " — " + country : ""}`,
             text: (iata+" "+name+" "+city+" "+country).toLowerCase() };
  };

  fetch("./airports.json")
    .then(r => r.json())
    .then(d => {
      const list = Array.isArray(d) ? d : (d.airports || d.data || []);
      A = list.map(toA).filter(Boolean);
    })
    .catch(console.error);

  const pos = el => {
    const r = el.getBoundingClientRect();
    box.style.left = (r.left + window.scrollX) + "px";
    box.style.top  = (r.bottom + window.scrollY + 6) + "px";
    box.style.width = r.width + "px";
  };

  const close = () => { box.style.display = "none"; box.innerHTML = ""; items = []; idx = 0; };

  const addChip = (chipsEl, code) => {
    code = (code || "").toUpperCase().trim();
    if (!/^[A-Z]{3}$/.test(code)) return;
    if ([...chipsEl.children].some(c => c.dataset.code === code)) return;

    const c = document.createElement("span");
    c.dataset.code = code;
    c.textContent = code + " ";
    const x = document.createElement("button");
    x.type = "button";
    x.textContent = "×";
    x.addEventListener("click", () => c.remove());
    c.appendChild(x);
    chipsEl.appendChild(c);
  };

  const highlight = () => {
    [...box.children].forEach((el, i) => el.style.background = (i === idx ? "#eee" : ""));
  };

  const choose = (i) => {
    const a = items[i];
    if (!a) return;
    addChip(activeChips, a.iata);
    activeIn.value = "";
    close();
    activeIn.focus();
  };

  const render = (inputEl) => {
    activeIn = inputEl;
    activeChips = (inputEl === depIn) ? depChips : arrChips;

    const q = (inputEl.value || "").toLowerCase().trim();
    if (!q || !A.length) return close();

    pos(inputEl);
    items = A.filter(a => a.text.includes(q)).slice(0, 8);
    if (!items.length) return close();

    box.innerHTML = items.map((a, i) =>
      `<div data-i="${i}" style="padding:8px;cursor:pointer">${a.label}</div>`
    ).join("");
    box.style.display = "block";
    idx = 0; highlight();
  };

  box.addEventListener("mousedown", (e) => {
    const d = e.target.closest("[data-i]");
    if (!d) return;
    e.preventDefault();
    choose(+d.dataset.i);
  });

  const wire = (el) => {
    el.addEventListener("input", () => render(el));
    el.addEventListener("focus", () => render(el));
    el.addEventListener("blur", () => setTimeout(close, 120));
    el.addEventListener("keydown", (e) => {
      if (box.style.display === "none") {
        if (e.key === "Enter") {
          const code = (el.value || "").toUpperCase().trim();
          if (/^[A-Z]{3}$/.test(code)) {
            addChip(el === depIn ? depChips : arrChips, code);
            el.value = "";
          }
        }
        return;
      }
      if (e.key === "Escape") return close();
      if (e.key === "ArrowDown") { e.preventDefault(); idx = Math.min(items.length - 1, idx + 1); highlight(); }
      if (e.key === "ArrowUp")   { e.preventDefault(); idx = Math.max(0, idx - 1); highlight(); }
      if (e.key === "Enter")     { e.preventDefault(); choose(idx); }
    });
  };

  wire(depIn); wire(arrIn);
  document.addEventListener("mousedown", (e) => {
    if (!box.contains(e.target) && e.target !== depIn && e.target !== arrIn) close();
  });



  const goBtn = document.getElementById("go");
  const statusEl = document.getElementById("st");


    // Helper to generate an array of YYYY-MM-DD strings between two dates
    const getDatesInRange = (startDateStr, endDateStr) => {
      const dates = [];
      let curr = new Date(startDateStr);
      const end = new Date(endDateStr);

      // Safety check for invalid dates
      if (isNaN(curr) || isNaN(end) || curr > end) return [];

      while (curr <= end) {
        dates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }
      return dates;
    };

    // Inside your search button click listener:
    goBtn.addEventListener("click", async () => {
      const depChips = document.getElementById("depChips");
      const arrChips = document.getElementById("arrChips");
      const d1 = document.getElementById("d1").value;
      const d2 = document.getElementById("d2").value;

      // 1. Extract and format the data to match FlightSearchQuery
      /** @type {FlightSearchQuery} */
      const searchQuery = {
        origins: Array.from(depChips.children).map(c => c.dataset.code),
        destinations: Array.from(arrChips.children).map(c => c.dataset.code),
        departure_dates: getDatesInRange(d1, d2)
      };

      // 2. Validation
      if (searchQuery.origins.length === 0 || searchQuery.destinations.length === 0) {
        statusEl.textContent = "❌ Please add at least one departure and arrival airport.";
        return;
      }
      if (searchQuery.departure_dates.length === 0) {
        statusEl.textContent = "❌ Please select both a start and end date.";
        return;
      }

      // 3. Send to backend
      console.log("Sending query:", searchQuery);

      try {
        const response = await fetch('YOUR_BACKEND_URL/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(searchQuery)
        });
        const results = await response.json();
        console.log("Results:", results);
        // Call your render function here...
      } catch (err) {
        console.error("Search failed", err);
      }
    });






});
