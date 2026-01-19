import type { FlightSearchResult } from "./frontend-data-interfaces/flight-search-result.ts";
import "../public/results.css";

function getDuration(start: string, end: string): string {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  return `${hours}h ${mins}m`;
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function renderFlightResults(listContainer: HTMLElement, moreWrapper: HTMLElement, results: FlightSearchResult[]) {
  listContainer.innerHTML = "";
  if (results.length === 0) {
    listContainer.innerHTML = `<div class="empty">No flights found.</div>`;
    moreWrapper.style.display = "none";
    return;
  }

  const resultsList = document.createElement("div");
  resultsList.className = "flight-results-list";

  resultsList.innerHTML = results.map(flight => {
    const first = flight.segments[0];
    const last = flight.segments[flight.segments.length - 1];
    const stopCount = flight.segments.length - 1;
    const stopsText = stopCount === 0 ? "Direct" : `${stopCount} stop${stopCount > 1 ? 's' : ''}`;
    const stopAirports = flight.segments.slice(0, -1).map(s => s.destination).join(", ");

    return `
      <div class="flight-card">
        <div class="flight-col airline-info">
          <span class="airline-name">${flight.airline}</span>
        </div>
        
        
        <div class="flight-col date-info">
          <span class="flight-date">${new Date(flight.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
        </div>

        <!-- NEW COMBINED COLUMN -->
        <div class="flight-col route-path-container">
          
          <!-- Start Time/Code -->
          <div class="endpoint">
             <span class="code">${first.origin}</span>
            <span class="time">${formatTime(first.start_time)}</span>
          </div>

          <!-- The Long Path (Duration on top, Line in middle, Stops on bottom) -->
          <div class="path-visual">
            <span class="duration-label">${getDuration(first.start_time, last.end_time)}</span>
            <div class="path-line"></div>
            <span class="stops-label ${stopCount > 0 ? 'has-stops' : ''}">
              ${stopsText} ${stopAirports ? `(${stopAirports})` : ''}
            </span>
          </div>

          <!-- End Time/Code -->
          <div class="endpoint">
            <span class="code">${last.destination}</span>
            <span class="time">${formatTime(last.end_time)}</span>
          </div>
          
        </div>

        <div class="flight-col price-info">
          <span class="price-val">$${flight.price.toFixed(0)}</span>
          <button class="select-btn">Select</button>
        </div>
      </div>
    `;
  }).join("");

  listContainer.appendChild(resultsList);
  moreWrapper.style.display = "block";
}