const ICONS = {
  trash: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  jump: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
  capture: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
};



const updateStickyOffsets = () => {
  const activeLoggingPanel = document.getElementById("activeLoggingPanel");
  const markersList = document.getElementById("markersList");
  if (!activeLoggingPanel || !markersList) return;

  const tableHeader = markersList.querySelector("thead");
  if (!tableHeader) return;

  const table = markersList.querySelector("table");
  if (!table) return;

  const scrollContainer = markersList.closest(".overflow-y-auto");
  if (!scrollContainer) return;

  const scrollContainerRect = scrollContainer.getBoundingClientRect();
  const tableRect = table.getBoundingClientRect();

  const trs = table.querySelectorAll("tr");
  const lastRow = trs.length > 0 ? trs[trs.length - 1] : null;
  const lastRowBottom = lastRow ? lastRow.getBoundingClientRect().bottom : tableRect.bottom;
  const tableBottom = lastRowBottom - scrollContainerRect.top;

  const headerTop = activeLoggingPanel.offsetHeight;
  const markerRows = markersList.querySelectorAll(".marker-row");
  const markerRowTop = headerTop + tableHeader.offsetHeight;

  const firstMarkerRow = markersList.querySelector(".marker-row");
  const markerRowHeight = firstMarkerRow ? firstMarkerRow.offsetHeight : 0;

  const footer = markersList.querySelector("#markersTableFoot");
  const footerTop = markerRowTop + markerRowHeight;
  const footerHeight = footer ? footer.offsetHeight : 0;

  const fullStackHeight = tableHeader.offsetHeight + markerRowHeight + footerHeight;
  let shift = 0;
  if (tableBottom < headerTop + fullStackHeight) {
    shift = (headerTop + fullStackHeight) - tableBottom;
  }

  tableHeader.style.top = `${headerTop - shift}px`;

  markerRows.forEach((row) => {
    const td = row.querySelector("td");
    if (td) {
      td.style.top = `${markerRowTop - 1 - shift}px`;
      td.style.zIndex = "10";
    }
  });

  if (footer) {
    footer.style.top = `${footerTop - 1 - shift}px`;
  }
};

const updateMarkersList = () => {
  try {
    if (!DOM.markersList) throw new Error("Markers list element not found");
    const rows = [
      `<table class="table table-fixed w-full font-mono text-base tabular-nums [&_th]:align-middle [&_td]:align-middle [&_th]:text-sm sm:[&_th]:text-base [&_td]:text-sm sm:[&_td]:text-base [&_th]:py-1 [&_th]:h-5">
           <thead class="sticky z-20 bg-zinc-50 dark:bg-zinc-900 shadow-sm">
           <tr>
             <th scope="col" class="text-left align-middle w-auto pl-1 sm:pl-2">
               Marker Name
             </th>
             <th scope="col" class="text-center w-36 whitespace-nowrap px-1">Start Time</th>
             <th scope="col" class="text-center w-36 whitespace-nowrap px-1">Duration</th>
             <th scope="col" class="text-center w-32 whitespace-nowrap pr-1 sm:pr-2">Actions</th>
           </tr>
         </thead>`,
    ];
    for (let i = 0; i < markers.length; i += 1) {
      const marker = markers[i];
      const markerTimeInputId = `markerTimeInput-${i}`;
      const formattedTime = formatTimeToHHMMSSMS(marker.startTime);
      const safeMarkerName = escapeHTML(marker.name);

      const isNegative = marker.startTime < 0;
      const isInvalid = isNegative || marker.startTime < processStartTime || (processEndTime > 0 && marker.startTime > processEndTime);
      const inputClass = isInvalid ? "text-red-500 dark:text-red-400" : "";
      const rowBgClass = isNegative
        ? "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400"
        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40";

      // Dynamically calculate Duration
      let duration = 0;
      if (i < markers.length - 1) {
        duration = markers[i + 1].startTime - marker.startTime;
      } else if (typeof player !== "undefined" && player && player.duration) {
        duration = player.duration - marker.startTime;
      }
      duration = Math.max(0, duration);

      const absDur = Math.round(duration);
      const hrs = Math.floor(absDur / 3600);
      const mins = Math.floor((absDur % 3600) / 60);
      const secs = absDur % 60;
      const formattedDuration = hrs > 0
        ? `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
        : `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

      rows.push(`
        <tr class="marker-row ${rowBgClass} border-b border-zinc-200 dark:border-zinc-700">
          <td class="pl-1 sm:pl-2 py-2">
            <div class="flex items-center gap-2">
              <button onclick="jumpToMarkerTime(${marker.startTime})" class="flex-shrink-0 text-yellow-500 hover:text-yellow-400 transition-colors focus:outline-none" title="Jump to Marker">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd" />
                </svg>
              </button>
              <input type="text" class="bg-transparent border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:bg-white dark:focus:bg-zinc-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-1 w-full text-sm font-semibold text-zinc-900 dark:text-zinc-200" value="${safeMarkerName}" onchange="updateMarkerName(${i}, this.value)" placeholder="Marker ${i + 1}">
            </div>
          </td>
          <td class="text-center py-2">
            <span class="inline-flex items-center gap-1">
              <input type="text" id="${markerTimeInputId}" class="form-control w-28 px-1 text-center font-mono tabular-nums text-sm ${inputClass}" value="${formattedTime}">
              <button onclick="syncMarkerToPlayhead(${i})" class="p-1 text-zinc-400 hover:text-blue-500 transition-colors" title="Sync to Playhead">${ICONS.capture}</button>
            </span>
          </td>
          <td class="text-center py-2">
            <span class="font-mono text-sm text-zinc-600 dark:text-zinc-400">${formattedDuration}</span>
          </td>
          <td class="text-center py-2 pr-1 sm:pr-2">
            <div class="flex gap-1.5 justify-center">
              <button onclick="jumpToMarkerTime(${marker.startTime})" class="btn btn-outline-secondary p-1 flex items-center justify-center" title="Jump to Marker">${ICONS.jump}</button>
              <button onclick="deleteMarker(${i})" class="btn btn-outline-danger p-1 flex items-center justify-center" title="Delete Marker">${ICONS.trash}</button>
            </div>
          </td>
        </tr>
      `);
    }

    rows.push(`
      </table>
      <div id="markersTableFoot" class="sticky z-20 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-[0_-2px_4px_rgba(0,0,0,0.05)] mt-[-1px] rounded-b-md"></div>
    `);

    DOM.markersList.innerHTML = rows.join("");

    DOM.markersTableFoot = document.getElementById("markersTableFoot");

    const table = DOM.markersList.querySelector("table");
    if (!table) throw new Error("Markers table element not found");
    if (markers.length > 0) {
      table.style.display = "table";
      updateProcessTimes();
    } else {
      table.style.display = "none";
    }

    // Attach listeners for manual input typing in start times
    for (let i = 0; i < markers.length; i += 1) {
      const markerTimeInput = document.getElementById(`markerTimeInput-${i}`);
      if (markerTimeInput) {
        markerTimeInput.addEventListener("change", (event) => {
          const newTime = parseTimeFromHHMMSSMS(event.target.value);
          if (newTime !== null) {
            markers[i].startTime = newTime;
            markers.sort((a, b) => a.startTime - b.startTime);
            saveLocalState();
            updateProcessTimes();
            updateMarkersList();
          } else {
            alert("Invalid time format. Please use HH:MM:SS.MS (e.g., 00:01:00.00).");
            markerTimeInput.value = formatTimeToHHMMSSMS(markers[i].startTime);
          }
        });
      }
    }

    if (typeof updateSliderTicks === "function") updateSliderTicks();
  } catch (error) {
    toConsole("updateMarkersList error", error.message, debuggin);
  }
};


const updateProcessTimes = () => {
  try {
    if (markers.length === 0) return;

    if (!DOM.markersTableFoot) {
      toConsole("updateProcessTimes skipped", "markersTableFoot is null", debuggin);
      return;
    }

    const formattedStartTime = formatTimeToHHMMSSMS(processStartTime);
    const formattedEndTime = formatTimeToHHMMSSMS(processEndTime);
    let totalProcessTime = "00:00:00.00";
    if (markers.length > 0) {
      const durationSeconds = Math.max(0, processEndTime - processStartTime);
      totalProcessTime = formatTimeToHHMMSSMS(durationSeconds);
    }

    DOM.markersTableFoot.innerHTML = `
      <div class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 w-full py-1">
        <span class="inline-flex items-center gap-1.5">
          <label for="processStartTimeInput" class="form-label font-mono text-sm mb-0" style="width: auto;">Process start time:</label>
          <input type="text" id="processStartTimeInput" class="form-control w-27.5 px-1 text-center font-mono tabular-nums text-sm" value="${formattedStartTime}">
        </span>
        <span class="inline-flex items-center gap-1.5">
          <label for="processEndTimeInput" class="form-label font-mono text-sm mb-0" style="width: auto;">Process end time:</label>
          <input type="text" id="processEndTimeInput" class="form-control w-27.5 px-1 text-center font-mono tabular-nums text-sm" value="${formattedEndTime}">
        </span>
        <span class="inline-flex items-center gap-1.5">
          <label for="totalProcessTimeInput" class="form-label font-mono text-sm mb-0" style="width: auto;">Total Process time:</label>
          <input type="text" id="totalProcessTimeInput" class="form-control w-27.5 px-1 text-center font-mono tabular-nums text-sm" value="${totalProcessTime}" disabled>
        </span>
      </div>
    `;

    const processStartTimeInput = document.getElementById("processStartTimeInput");
    if (!processStartTimeInput) throw new Error("Process start time input not found");
    processStartTimeInput.addEventListener("change", (event) => {
      const newStartTime = parseTimeFromHHMMSSMS(event.target.value);
      if (newStartTime !== null) {
        processStartTime = newStartTime;
        toConsole("Process start time updated", processStartTime, debuggin);

        if (typeof player !== "undefined" && player && player.currentTime < processStartTime) {
          player.currentTime = processStartTime;
        }

        const invalidMarkers = markers.filter((m) => m.startTime < processStartTime);
        if (invalidMarkers.length > 0) {
          invalidMarkers.forEach((m) => {
            showToast(`Marker "${m.name}" starts before Process Start Time.`, "error");
          });
        }

        const durationSeconds = Math.max(0, processEndTime - processStartTime);
        document.getElementById("totalProcessTimeInput").value = formatTimeToHHMMSSMS(durationSeconds);
        saveLocalState();
        if (typeof updateSliderTicks === "function") updateSliderTicks();
        if (typeof updateMarkersList === "function") updateMarkersList();
      } else {
        alert("Invalid time format. Please use HH:MM:SS.MS (e.g., 00:01:00.00).");
        processStartTimeInput.value = formatTimeToHHMMSSMS(processStartTime);
      }
    });

    const processEndTimeInput = document.getElementById("processEndTimeInput");
    if (!processEndTimeInput) throw new Error("Process end time input not found");
    processEndTimeInput.addEventListener("change", (event) => {
      const newEndTime = parseTimeFromHHMMSSMS(event.target.value);
      if (newEndTime !== null) {
        processEndTime = newEndTime;
        toConsole("Process end time updated", processEndTime, debuggin);

        if (typeof player !== "undefined" && player && processEndTime > 0 && player.currentTime > processEndTime) {
          player.currentTime = processEndTime;
        }

        const invalidMarkers = markers.filter((m) => m.startTime > processEndTime);
        if (invalidMarkers.length > 0) {
          invalidMarkers.forEach((m) => {
            showToast(`Marker "${m.name}" starts after Process End Time.`, "error");
          });
        }

        const durationSeconds = Math.max(0, processEndTime - processStartTime);
        document.getElementById("totalProcessTimeInput").value = formatTimeToHHMMSSMS(durationSeconds);
        saveLocalState();
        if (typeof updateSliderTicks === "function") updateSliderTicks();
        if (typeof updateMarkersList === "function") updateMarkersList();
      } else {
        alert("Invalid time format. Please use HH:MM:SS.MS (e.g., 00:01:00.00).");
        processEndTimeInput.value = formatTimeToHHMMSSMS(processEndTime);
      }
    });
  } catch (error) {
    toConsole("updateProcessTimes error", error.message, debuggin);
  }
};
