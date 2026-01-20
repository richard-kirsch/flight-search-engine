import { config } from './config';
import type {Airport} from "./frontend-data-interfaces/airport";
import type {FlightSearchQuery} from "./frontend-data-interfaces/flight-search-query";
import type {FlightSearchResult} from "./frontend-data-interfaces/flight-search-result";
import {renderFlightResults} from "./results-renderer";

document.addEventListener("DOMContentLoaded", () => {
  // Type-safe DOM selection
  const depIn = document.getElementById("depIn") as HTMLInputElement | null;
  const arrIn = document.getElementById("arrIn") as HTMLInputElement | null;
  const depChips = document.getElementById("depChips") as HTMLElement | null;
  const arrChips = document.getElementById("arrChips") as HTMLElement | null;
  const goBtn = document.getElementById("go") as HTMLButtonElement | null;
  const statusEl = document.getElementById("st") as HTMLElement | null;
  const d1In = document.getElementById("d1") as HTMLInputElement | null;
  const d2In = document.getElementById("d2") as HTMLInputElement | null;
  const listContainer = document.getElementById("list") as HTMLElement;
  const moreWrapper = document.getElementById("more") as HTMLElement;

  if (!depIn || !arrIn || !depChips || !arrChips || !goBtn || !statusEl || !d1In || !d2In || !listContainer || !moreWrapper) return;

  // State Management
  let A: Airport[] = [];
  let items: Airport[] = [];
  let idx: number = 0;
  let activeIn: HTMLInputElement | null = null;
  let activeChips: HTMLElement | null = null;

  // Create UI Box for Autocomplete
  const box = document.createElement("div");
  Object.assign(box.style, {
    position: "absolute",
    display: "none",
    background: "white",
    border: "1px solid #ccc",
    zIndex: "99999"
  });
  document.body.appendChild(box);

  const pick = (o: any, ks: string[]): string => {
    for (const k of ks) if (o && o[k]) return o[k];
    return "";
  };

  const toA = (o: any): Airport | null => {
    const iata = (pick(o, ["iata", "IATA", "iata_code", "iataCode", "code"]) || "").toString().toUpperCase().trim();
    if (iata.length !== 3) return null;

    const name = pick(o, ["name", "airport", "airport_name", "airportName"]);
    const city = pick(o, ["city", "municipality"]);
    const country = pick(o, ["country", "iso_country", "countryName"]);

    return {
      iata,
      label: `${name || city || iata} (${iata})${country ? " — " + country : ""}`,
      text: (iata + " " + name + " " + city + " " + country).toLowerCase()
    };
  };

  fetch("./airports.json")
    .then(r => r.json())
    .then(d => {
      const list = Array.isArray(d) ? d : (d.airports || d.data || []);
      A = list.map(toA).filter((item: Airport | null): item is Airport => item !== null);
    })
    .catch(console.error);

  const pos = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    box.style.left = (r.left + window.scrollX) + "px";
    box.style.top = (r.bottom + window.scrollY + 6) + "px";
    box.style.width = r.width + "px";
  };

  const close = () => {
    box.style.display = "none";
    box.innerHTML = "";
    items = [];
    idx = 0;
  };

  const addChip = (chipsEl: HTMLElement, code: string) => {
    code = (code || "").toUpperCase().trim();
    if (!/^[A-Z]{3}$/.test(code)) return;
    if ([...chipsEl.children].some(c => (c as HTMLElement).dataset.code === code)) return;

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
    Array.from(box.children).forEach((el, i) => {
      (el as HTMLElement).style.background = (i === idx ? "#eee" : "");
    });
  };

  const choose = (i: number) => {
    const a = items[i];
    if (!a || !activeChips || !activeIn) return;
    addChip(activeChips, a.iata);
    activeIn.value = "";
    close();
    activeIn.focus();
  };

  const render = (inputEl: HTMLInputElement) => {
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
    idx = 0;
    highlight();
  };

  box.addEventListener("mousedown", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const d = target.closest("[data-i]") as HTMLElement | null;
    if (!d) return;
    e.preventDefault();
    choose(Number(d.dataset.i));
  });

  const wire = (el: HTMLInputElement) => {
    el.addEventListener("input", () => render(el));
    el.addEventListener("focus", () => render(el));
    el.addEventListener("blur", () => setTimeout(close, 120));
    el.addEventListener("keydown", (e: KeyboardEvent) => {
      if (box.style.display === "none") {
        if (e.key === "Enter") {
          const code = (el.value || "").toUpperCase().trim();
          if (/^[A-Z]{3}$/.test(code)) {
            addChip(el === depIn ? depChips! : arrChips!, code);
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

  wire(depIn);
  wire(arrIn);

  document.addEventListener("mousedown", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!box.contains(target) && target !== depIn && target !== arrIn) close();
  });

  const getDatesInRange = (startDateStr: string, endDateStr: string): string[] => {
    const dates: string[] = [];
    let curr = new Date(startDateStr);
    const end = new Date(endDateStr);

    if (isNaN(curr.getTime()) || isNaN(end.getTime()) || curr > end) return [];

    while (curr <= end) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  };

  goBtn.addEventListener("click", async () => {
    // TODO: Disable button
    const d1 = d1In.value;
    const d2 = d2In.value;

    const searchQuery: FlightSearchQuery = {
      origins: Array.from(depChips.children).map(c => (c as HTMLElement).dataset.code || ""),
      destinations: Array.from(arrChips.children).map(c => (c as HTMLElement).dataset.code || ""),
      departure_dates: getDatesInRange(d1, d2)
    };

    if (searchQuery.origins.length === 0 || searchQuery.destinations.length === 0) {
      statusEl.textContent = "❌ Please add at least one departure and arrival airport.";
      return;
    }
    if (searchQuery.departure_dates.length === 0) {
      statusEl.textContent = "❌ Please select both a start and end date.";
      return;
    }

    try {
      goBtn.disabled = true

      statusEl.textContent = "Searching...";
      const response = await fetch(`${config.apiUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchQuery)
      });

      const results: FlightSearchResult[] = await response.json();
      console.log("Results:", results);
      statusEl.textContent = `Found ${results.length} flights!`;


      if (results) {
        renderFlightResults(listContainer, moreWrapper, results);
      }

    } catch (err) {
      console.error("Search failed", err);
      statusEl.textContent = "❌ Search failed.";
    } finally {
      goBtn.disabled = false
    }
  });
});