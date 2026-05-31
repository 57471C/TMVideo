const ICONS = {
  trash: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  jump: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
  capture: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  standard: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  jumpType: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><circle cx="6" cy="18" r="2" fill="currentColor"/><circle cx="18" cy="18" r="2" fill="currentColor"/><path d="M6 14C6 8 18 8 18 14"/><path d="M15 11l3 3 3-3"/></svg>`,
  loopType: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>`,
  inType: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M5 4h4v16H5zM19 12l-6-6v12z"/></svg>`,
  outType: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M15 4h4v16h-4zM5 12l6 6V6z"/></svg>`,
};

const toggleTypeDropdown = (e, index) => {
  e.stopPropagation();
  const menus = document.querySelectorAll('[id^="type-menu-"]');
  for (const menu of menus) {
    if (menu.id !== `type-menu-${index}`) {
      menu.classList.add("hidden");
    }
  }
  const menu = document.getElementById(`type-menu-${index}`);
  if (menu) {
    menu.classList.toggle("hidden");
  }
};

document.addEventListener("click", () => {
  const menus = document.querySelectorAll('[id^="type-menu-"]');
  for (const menu of menus) {
    menu.classList.add("hidden");
  }
});

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
             <th scope="col" class="text-center w-40 whitespace-nowrap px-1">Start Time</th>
             <th scope="col" class="text-center w-24 whitespace-nowrap px-1">Duration</th>
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
      } else if (typeof player !== "undefined" && player) {
        const activeVideo = videoQueue[activeQueueIndex] || {};
        const endLimit = (activeVideo.virtualEndTime !== null && activeVideo.virtualEndTime !== undefined) ? activeVideo.virtualEndTime : player.duration;
        duration = endLimit - marker.startTime;
      }
      if (duration < 0) duration = 0;

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
              <button onclick="jumpToMarkerTime(${marker.startTime})" class="flex-shrink-0 text-yellow-500 hover:text-yellow-400 transition-colors focus:outline-none" title="Jump here (Paused)">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
              </button>
              <button onclick="playFromMarkerTime(${marker.startTime})" class="flex-shrink-0 text-green-500 hover:text-green-400 transition-colors focus:outline-none" title="Play from here">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              </button>
              <input type="text" class="bg-transparent border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:bg-white dark:focus:bg-zinc-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-1 w-full text-sm font-semibold text-zinc-900 dark:text-zinc-200" value="${safeMarkerName}" onchange="updateMarkerName(${i}, this.value)" placeholder="Marker ${i + 1}">
              <div class="relative inline-block text-left marker-type-dropdown">
                <button type="button" onclick="toggleTypeDropdown(event, ${i})" class="inline-flex items-center justify-center p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none cursor-pointer" id="type-btn-${i}">
                  ${marker.type === "standard" ? ICONS.standard : marker.type === "jump" ? ICONS.jumpType : marker.type === "loop" ? ICONS.loopType : marker.type === "in" ? ICONS.inType : ICONS.outType}
                </button>
                <div id="type-menu-${i}" class="hidden absolute left-0 mt-1 w-40 rounded-md shadow-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none z-50">
                  <div class="py-1">
                    <button onclick="updateMarkerType(${i}, 'standard')" class="w-full text-left px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 flex items-center gap-2 cursor-pointer font-semibold">
                      ${ICONS.standard} Standard
                    </button>
                    <button onclick="updateMarkerType(${i}, 'jump')" class="w-full text-left px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 flex items-center gap-2 cursor-pointer font-semibold">
                      ${ICONS.jumpType} Jump
                    </button>
                    <button onclick="updateMarkerType(${i}, 'loop')" class="w-full text-left px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 flex items-center gap-2 cursor-pointer font-semibold">
                      ${ICONS.loopType} Loop
                    </button>
                    <button onclick="updateMarkerType(${i}, 'in')" class="w-full text-left px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 flex items-center gap-2 cursor-pointer font-semibold">
                      ${ICONS.inType} Set Video Start
                    </button>
                    <button onclick="updateMarkerType(${i}, 'out')" class="w-full text-left px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 flex items-center gap-2 cursor-pointer font-semibold">
                      ${ICONS.outType} Set Video End
                    </button>
                  </div>
                </div>
              </div>
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
    } else {
      table.style.display = "none";
    }
    updateVideoTimeSummary();

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
            updateVideoTimeSummary();
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

const updateVideoTimeSummary = () => {
  try {
    const footer = document.getElementById("markersTableFoot");
    if (!footer) {
      toConsole("updateVideoTimeSummary skipped", "markersTableFoot is null", debuggin);
      return;
    }

    const activeVideo = (typeof videoQueue !== "undefined" && videoQueue[activeQueueIndex]) || {};

    const startMarker = markers.find((m) => m.type === "in" || m.type === "start");
    processStartTime = startMarker ? startMarker.startTime : 0;

    const endMarker = markers.find((m) => m.type === "out" || m.type === "end");
    if (endMarker) {
      processEndTime = endMarker.startTime;
    } else if (typeof player !== "undefined" && player && player.duration) {
      processEndTime = player.duration;
    } else {
      processEndTime = 0;
    }

    let duration = processEndTime - processStartTime;
    if (duration < 0) duration = 0;

    if (markers.length > 0) {
      for (let i = 0; i < markers.length; i += 1) {
        if (markers[i].type === "jump") {
          let markerDur = 0;
          if (i < markers.length - 1) {
            markerDur = markers[i + 1].startTime - markers[i].startTime;
          } else {
            markerDur = processEndTime - markers[i].startTime;
          }
          if (markerDur > 0) {
            duration -= markerDur;
          }
        }
      }
    }
    if (duration < 0) duration = 0;

    const formattedStartTime = formatTimeToHHMMSSMS(processStartTime);
    const formattedEndTime = formatTimeToHHMMSSMS(processEndTime);
    const formattedDuration = formatTimeToHHMMSSMS(duration);

    footer.innerHTML = `
      <div class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 w-full py-1 text-sm font-medium">
        <span class="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
          <span>Video Start Time:</span>
          <span id="videoStartTimeDisplay" class="font-mono font-bold text-zinc-900 dark:text-white">${formattedStartTime}</span>
        </span>
        <span class="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
          <span>Video End Time:</span>
          <span id="videoEndTimeDisplay" class="font-mono font-bold text-zinc-900 dark:text-white">${formattedEndTime}</span>
        </span>
        <span class="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
          <span>Video Duration:</span>
          <span id="videoDurationDisplay" class="font-mono font-bold text-zinc-900 dark:text-white">${formattedDuration}</span>
        </span>
      </div>
    `;
  } catch (error) {
    toConsole("updateVideoTimeSummary error", error.message, debuggin);
  }
};
