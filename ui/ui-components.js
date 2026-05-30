const ICONS = {
  trash: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  part: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586a2 2 0 0 0-2.828 0L2.586 9.757a2 2 0 0 0 0 2.828l9.172 9.172a2 2 0 0 0 2.828 0l7.172-7.172a2 2 0 0 0 0-2.828L12.586 2.586z"/><circle cx="8.5" cy="8.5" r="1.5"/></svg>`,
  partSmall: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-70"><path d="M12.586 2.586a2 2 0 0 0-2.828 0L2.586 9.757a2 2 0 0 0 0 2.828l9.172 9.172a2 2 0 0 0 2.828 0l7.172-7.172a2 2 0 0 0 0-2.828L12.586 2.586z"/><circle cx="8.5" cy="8.5" r="1.5"/></svg>`,
  labour: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`,
  labourSmall: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-70"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`,
  chartCol: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M8 8h6"/><path d="M11 12h5"/><path d="M14 16h6"/></svg>`,
  chartGantt: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  jump: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`,
  edit: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
  split: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`,
};

const openStatusModal = (e, opIndex, taskIndex) => {
  currentStatusEdit = { opIndex, taskIndex };
  const dialog = DOM.statusModal;

  dialog.style.inset = "auto";
  dialog.style.margin = "0";
  dialog.showModal();

  const rect = dialog.getBoundingClientRect();
  let top = e.clientY + 5;
  let left = e.clientX + 5;

  if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 5;
  if (top + rect.height > window.innerHeight) top = window.innerHeight - rect.height - 5;

  dialog.style.left = `${left}px`;
  dialog.style.top = `${top}px`;
};

const openOpContextMenu = (e, opIndex) => {
  e.stopPropagation();
  currentOpContextIndex = opIndex;

  const menu = DOM.opContextMenu;
  menu.classList.remove("hidden");

  const rect = e.currentTarget.getBoundingClientRect();
  let left = rect.left + window.scrollX;
  let top = rect.bottom + 4 + window.scrollY;

  const menuRect = menu.getBoundingClientRect();
  if (left + menuRect.width > window.innerWidth) {
    left = window.innerWidth - menuRect.width - 10;
  }
  if (top + menuRect.height > window.innerHeight) {
    top = rect.top + window.scrollY - menuRect.height - 4;
  }

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
};

const removeTag = (target, opIndex, taskIndex, tagType, tagIdx) => {
  if (target === "op") {
    operations[opIndex].partTags.splice(tagIdx, 1);
  } else if (target === "task") {
    const task = operations[opIndex].tasks[taskIndex];
    if (tagType === "part") {
      task.partTags.splice(tagIdx, 1);
    } else if (tagType === "labour") {
      task.labourTags.splice(tagIdx, 1);
    }
  }
  saveLocalState();
  updateTaskList();
};

const deleteMasterDataTag = async (type, index) => {
  const arr = type === "part" ? masterParts : masterLabour;
  const title = type === "part" ? "Part Numbers" : "Labour Codes";
  const tag = arr[index];

  if (await asyncConfirm(`Are you sure you want to delete "${tag}" from the master list?`, "Delete Master Tag")) {
    arr.splice(index, 1);
    saveLocalState();
    showMasterDataModal(title, arr, type);
  }
};

const clearMasterData = async (type) => {
  const title = type === "part" ? "Part Numbers" : "Labour Codes";
  if (await asyncConfirm(`Are you sure you want to clear ALL ${title}? This action cannot be undone.`, "Clear All")) {
    if (type === "part") masterParts = [];
    else masterLabour = [];
    saveLocalState();
    showMasterDataModal(title, type === "part" ? masterParts : masterLabour, type);
  }
};

const showMasterDataModal = (title, dataArray, type) => {
  DOM.masterDataModalTitle.textContent = `${title} (${dataArray.length})`;
  DOM.masterDataList.innerHTML = dataArray.length
    ? dataArray
        .map(
          (item, idx) =>
            `<li class="px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors flex justify-between items-center group"><span>${escapeHTML(item)}</span><button type="button" onclick="deleteMasterDataTag('${type}', ${idx})" class="text-zinc-400 hover:text-red-500 dark:hover:text-red-400 focus:outline-none transition-colors opacity-0 group-hover:opacity-100" title="Delete Tag">${ICONS.trash}</button></li>`,
        )
        .join("")
    : `<li class="px-4 py-4 text-sm text-zinc-500 italic text-center">No data loaded.</li>`;

  DOM.clearMasterDataBtn.onclick = () => clearMasterData(type);
  DOM.clearMasterDataBtn.style.display = dataArray.length ? "inline-block" : "none";
  if (!DOM.masterDataModal.open) DOM.masterDataModal.showModal();
};

const openOpPartDropdown = (e, opIndex) => {
  e.stopPropagation();
  let dropdown = document.getElementById("op-part-dropdown");
  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.id = "op-part-dropdown";
    dropdown.className =
      "absolute bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-50 flex flex-col w-96 max-h-64";
    document.body.appendChild(dropdown);

    document.addEventListener("click", (ev) => {
      if (dropdown && !dropdown.classList.contains("hidden") && !dropdown.contains(ev.target)) {
        dropdown.classList.add("hidden");
      }
    });
  }

  const rect = e.currentTarget.getBoundingClientRect();
  dropdown.style.left = `${rect.left + window.scrollX}px`;
  dropdown.style.top = `${rect.bottom + 4 + window.scrollY}px`;
  dropdown.classList.remove("hidden");

  const renderList = (filter = "") => {
    const currentParts = (operations[opIndex].partTags || []).map((t) => {
      const idx = t.indexOf(" x ");
      return idx !== -1 ? t.substring(idx + 3) : t;
    });
    const filtered = masterParts.filter(
      (p) => p.toLowerCase().includes(filter.toLowerCase()) && !currentParts.includes(p),
    );
    if (filtered.length === 0 && filter.trim() === "") {
      return `<li class="px-2 py-1 text-sm text-zinc-500 italic">No part numbers available. Type to add one.</li>`;
    }
    return filtered
      .map(
        (p) =>
          `<li class="px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer rounded truncate" data-part="${escapeHTML(p)}" title="${escapeHTML(p)}">${escapeHTML(p)}</li>`,
      )
      .join("");
  };

  dropdown.innerHTML = `
    <div class="p-2 border-b border-zinc-200 dark:border-zinc-700 flex gap-1.5">
      <input type="text" id="op-part-qty" class="form-control text-sm w-10 text-center" value="01" maxlength="4" title="Part Quantity" onfocus="this.select()">
      <input type="text" id="op-part-search" class="form-control text-sm flex-1" placeholder="Search or add new... (Enter)">
    </div>
    <ul id="op-part-list" class="overflow-y-auto flex-1 p-1 m-0 list-none space-y-0.5 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-thumb]:rounded-full">
      ${renderList()}
    </ul>
  `;

  const input = document.getElementById("op-part-search");
  const qtyInput = document.getElementById("op-part-qty");
  const list = document.getElementById("op-part-list");

  input.focus();

  const attachListEvents = () => {
    for (const li of list.querySelectorAll("li[data-part]")) {
      li.addEventListener("click", () => {
        addTag(li.getAttribute("data-part"));
      });
    }
  };

  const addTag = (newTag) => {
    if (!newTag) return;

    const qtyValue = qtyInput ? qtyInput.value.trim() : "01";
    const finalQty = qtyValue === "" ? "01" : qtyValue;

    let addedNewMaster = false;
    if (!masterParts.includes(newTag)) {
      masterParts.push(newTag);
      addedNewMaster = true;
    }

    const displayTag = `${finalQty} x ${newTag}`;
    if (!operations[opIndex].partTags.includes(displayTag)) {
      operations[opIndex].partTags.push(displayTag);
    }
    if (addedNewMaster) {
      showToast("New part number added to Master Data.", "success");
    }
    saveLocalState();
    updateTaskList();

    input.value = "";
    if (qtyInput) qtyInput.value = "01";
    list.innerHTML = renderList("");
    attachListEvents();
    input.focus();
  };

  input.addEventListener("input", (ev) => {
    list.innerHTML = renderList(ev.target.value);
    attachListEvents();
  });

  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      addTag(input.value.trim());
    } else if (ev.key === "Escape") {
      dropdown.classList.add("hidden");
    }
  });

  qtyInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      addTag(input.value.trim());
    } else if (ev.key === "Escape") {
      dropdown.classList.add("hidden");
    }
  });

  attachListEvents();
};

const openTaskLabourDropdown = (e, opIndex, taskIndex) => {
  e.stopPropagation();
  let dropdown = document.getElementById("task-labour-dropdown");
  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.id = "task-labour-dropdown";
    dropdown.className =
      "absolute bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-50 flex flex-col w-96 max-h-64";
    document.body.appendChild(dropdown);

    document.addEventListener("click", (ev) => {
      if (dropdown && !dropdown.classList.contains("hidden") && !dropdown.contains(ev.target)) {
        dropdown.classList.add("hidden");
      }
    });
  }

  const rect = e.currentTarget.getBoundingClientRect();
  dropdown.style.left = `${rect.left + window.scrollX}px`;
  dropdown.style.top = `${rect.bottom + 4 + window.scrollY}px`;
  dropdown.classList.remove("hidden");

  const renderList = (filter = "") => {
    const currentTags = operations[opIndex].tasks[taskIndex].labourTags || [];
    const filtered = masterLabour.filter(
      (p) => p.toLowerCase().includes(filter.toLowerCase()) && !currentTags.includes(p),
    );
    if (filtered.length === 0 && filter.trim() === "") {
      return `<li class="px-2 py-1 text-sm text-zinc-500 italic">No labour codes available. Type to add one.</li>`;
    }
    return filtered
      .map(
        (p) =>
          `<li class="px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer rounded truncate" data-labour="${escapeHTML(p)}" title="${escapeHTML(p)}">${escapeHTML(p)}</li>`,
      )
      .join("");
  };

  dropdown.innerHTML = `
    <div class="p-2 border-b border-zinc-200 dark:border-zinc-700 flex gap-1.5">
      <input type="text" id="task-labour-search" class="form-control text-sm flex-1" placeholder="Search or add new... (Enter)">
    </div>
    <ul id="task-labour-list" class="overflow-y-auto flex-1 p-1 m-0 list-none space-y-0.5 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-thumb]:rounded-full">
      ${renderList()}
    </ul>
  `;

  const input = document.getElementById("task-labour-search");
  const list = document.getElementById("task-labour-list");

  input.focus();

  const attachListEvents = () => {
    for (const li of list.querySelectorAll("li[data-labour]")) {
      li.addEventListener("click", () => {
        addTag(li.getAttribute("data-labour"));
      });
    }
  };

  const addTag = (newTag) => {
    if (!newTag) return;

    let addedNewMaster = false;
    if (!masterLabour.includes(newTag)) {
      masterLabour.push(newTag);
      addedNewMaster = true;
    }

    if (!operations[opIndex].tasks[taskIndex].labourTags.includes(newTag)) {
      operations[opIndex].tasks[taskIndex].labourTags.push(newTag);
    }
    if (addedNewMaster) {
      showToast("New labour code added to Master Data.", "success");
    }
    saveLocalState();
    updateTaskList();

    input.value = "";
    list.innerHTML = renderList("");
    attachListEvents();
    input.focus();
  };

  input.addEventListener("input", (ev) => {
    list.innerHTML = renderList(ev.target.value);
    attachListEvents();
  });

  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      addTag(input.value.trim());
    } else if (ev.key === "Escape") {
      dropdown.classList.add("hidden");
    }
  });

  attachListEvents();
};

const openOpBulkLabourDropdown = (e, opIndex) => {
  e.stopPropagation();
  let dropdown = document.getElementById("op-bulk-labour-dropdown");
  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.id = "op-bulk-labour-dropdown";
    dropdown.className =
      "absolute bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg z-50 flex flex-col w-96 max-h-64";
    document.body.appendChild(dropdown);

    document.addEventListener("click", (ev) => {
      if (dropdown && !dropdown.classList.contains("hidden") && !dropdown.contains(ev.target)) {
        dropdown.classList.add("hidden");
      }
    });
  }

  const rect = e.currentTarget.getBoundingClientRect();
  dropdown.style.left = `${rect.left + window.scrollX}px`;
  dropdown.style.top = `${rect.bottom + 4 + window.scrollY}px`;
  dropdown.classList.remove("hidden");

  const renderList = (filter = "") => {
    const tasks = operations[opIndex]?.tasks || [];
    const commonTags = masterLabour.filter(
      (tag) => tasks.length > 0 && tasks.every((task) => (task.labourTags || []).includes(tag)),
    );

    const filtered = masterLabour.filter(
      (p) => p.toLowerCase().includes(filter.toLowerCase()) && !commonTags.includes(p),
    );
    if (filtered.length === 0 && filter.trim() === "") {
      return `<li class="px-2 py-1 text-sm text-zinc-500 italic">No labour codes available. Type to add one.</li>`;
    }
    return filtered
      .map(
        (p) =>
          `<li class="px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer rounded truncate" data-labour="${escapeHTML(p)}" title="${escapeHTML(p)}">${escapeHTML(p)}</li>`,
      )
      .join("");
  };

  dropdown.innerHTML = `
    <div class="p-2 border-b border-zinc-200 dark:border-zinc-700 flex gap-1.5">
      <input type="text" id="op-bulk-labour-search" class="form-control text-sm flex-1" placeholder="Search or add to all tasks... (Enter)">
    </div>
    <ul id="op-bulk-labour-list" class="overflow-y-auto flex-1 p-1 m-0 list-none space-y-0.5 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-thumb]:rounded-full">
      ${renderList()}
    </ul>
  `;

  const input = document.getElementById("op-bulk-labour-search");
  const list = document.getElementById("op-bulk-labour-list");

  input.focus();

  const attachListEvents = () => {
    for (const li of list.querySelectorAll("li[data-labour]")) {
      li.addEventListener("click", () => {
        addTag(li.getAttribute("data-labour"));
      });
    }
  };

  const addTag = (newTag) => {
    if (!newTag) return;

    let addedNewMaster = false;
    if (!masterLabour.includes(newTag)) {
      masterLabour.push(newTag);
      addedNewMaster = true;
    }

    const tasks = operations[opIndex]?.tasks || [];
    let tasksUpdated = false;

    for (const task of tasks) {
      if (!task.labourTags) {
        task.labourTags = [];
      }
      if (!task.labourTags.includes(newTag)) {
        task.labourTags.push(newTag);
        tasksUpdated = true;
      }
    }

    if (addedNewMaster) {
      showToast("New labour code added to Master Data.", "success");
    }
    if (tasksUpdated) {
      saveLocalState();
      updateTaskList();
    } else if (tasks.length === 0) {
      showToast("No tasks available to assign labour.", "error");
    }

    input.value = "";
    list.innerHTML = renderList("");
    attachListEvents();
    input.focus();
  };

  input.addEventListener("input", (ev) => {
    list.innerHTML = renderList(ev.target.value);
    attachListEvents();
  });

  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      addTag(input.value.trim());
    } else if (ev.key === "Escape") {
      dropdown.classList.add("hidden");
    }
  });

  attachListEvents();
};

const renderTags = (tags, type, target, opIndex, taskIndex = -1, size = "normal") => {
  if (!tags || tags.length === 0) return "";
  const typeClass = type === "part" ? "tag-pill-part" : "tag-pill-labour";

  let sizeClasses = "";
  if (size === "xs") {
    sizeClasses = "text-[10px] py-0.5 px-1.5 leading-none";
  }

  const icon = size === "xs" ? "" : type === "part" ? ICONS.partSmall : ICONS.labourSmall;

  return `<div class="tag-container ${size === "xs" ? "gap-1 mt-0" : ""}">
    ${tags.map((tag, idx) => `<span class="tag-pill ${typeClass} ${sizeClasses}">${icon ? `${icon} ` : ""}<span class="${size === "xs" ? "translate-y-px" : ""}">${escapeHTML(tag)}</span><button type="button" onclick="removeTag('${target}', ${opIndex}, ${taskIndex}, '${type}', ${idx})" class="hover:text-red-500 dark:hover:text-red-400 font-bold ml-0.5 leading-none focus:outline-none transition-colors" title="Remove Tag">&times;</button></span>`).join("")}
  </div>`;
};

const buildOpRow = (op, i) => {
  const opTimeInputId = `opTimeInput-${i}`;
  const formattedTime = formatTimeToHHMMSSMS(op.startTime);
  const safeOpName = escapeHTML(op.name);
  const isNegative = op.startTime < 0;
  const isInvalid = isNegative || op.startTime < processStartTime || (processEndTime > 0 && op.startTime > processEndTime);
  const inputClass = isInvalid ? "text-red-500 dark:text-red-400" : "";
  const tdBgClass = isNegative
    ? "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400"
    : "bg-zinc-50 dark:bg-zinc-900";

  // Sum sub-task durations
  const totalMs = (op.tasks || []).reduce((sum, task) => sum + (task.duration || 0), 0);
  const formattedTotalTime =
    durationMode === "hhmmssms"
      ? formatDuration(totalMs)
      : durationMode === "ms"
        ? totalMs.toFixed(3)
        : formatDecimalMinutes(totalMs);

  return `
    <tr class="operation-row">
      <td colspan="4" class="sticky z-10 ${tdBgClass} border-y border-zinc-200 dark:border-zinc-700 shadow-sm">
        <div class="flex items-center justify-between w-full">
          <div class="flex-1 mr-4">
            <div class="flex items-center gap-2 flex-wrap">
              <button onclick="jumpToOperationTime('${opTimeInputId}')" class="p-1 bg-transparent border-0 shadow-none hover:bg-yellow-50 dark:hover:bg-yellow-500/10 rounded transition-colors text-yellow-500 dark:text-yellow-400 focus:outline-none flex items-center justify-center cursor-pointer shrink-0" title="Jump to Operation Time">
                ${ICONS.jump}
              </button>
              <button onclick="openOpContextMenu(event, ${i})" class="font-bold text-lg shrink-0 text-left bg-transparent border-0 p-0 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer focus:outline-none transition-colors hover:underline select-none" title="Operation Options">${safeOpName}</button>
              <span class="inline-flex items-center gap-1.5 ml-2.5 shrink-0">
                <label for="${opTimeInputId}" class="form-label font-mono text-base mb-0" style="width: auto;">Start:</label>
                <input type="text" id="${opTimeInputId}" class="form-control w-31.25 px-1 text-center font-mono tabular-nums text-base ${inputClass}" value="${formattedTime}">
              </span>
              <span class="inline-flex items-center gap-1.5 ml-2.5 shrink-0">
                <span class="font-mono text-base text-zinc-500 dark:text-zinc-400">Total:</span>
                <input type="text" class="form-control w-31.25 px-1 text-center font-mono tabular-nums text-base bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 cursor-not-allowed border-zinc-200 dark:border-zinc-700" value="${formattedTotalTime}" readonly tabindex="-1" title="Total sub-task duration">
              </span>
              <button onclick="openOpPartDropdown(event, ${i})" class="p-1 bg-transparent border-0 shadow-none hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors text-zinc-600 dark:text-zinc-400 focus:outline-none flex items-center justify-center cursor-pointer shrink-0" title="Assign Part Numbers">
                ${ICONS.part}
              </button>
              ${renderTags(op.partTags || [], "part", "op", i, -1, "xs")}
              <button onclick="openOpBulkLabourDropdown(event, ${i})" class="p-1 bg-transparent border-0 shadow-none hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors text-zinc-600 dark:text-zinc-400 focus:outline-none flex items-center justify-center cursor-pointer shrink-0 ml-1" title="Assign Labour to All Tasks">
                ${ICONS.labour}
              </button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  `;
};

const buildTaskRow = (task, i, j) => {
  const durationValue =
    durationMode === "hhmmssms"
      ? formatDuration(task.duration)
      : durationMode === "ms"
        ? task.duration.toFixed(3)
        : formatDecimalMinutes(task.duration);
  const safeTaskName = escapeHTML(task.name);
  let badgeClass = "";

  if (task.status === "VA")
    badgeClass = "border-emerald-500/50 text-emerald-600 dark:border-emerald-400/50 dark:text-emerald-400";
  else if (task.status === "NVA")
    badgeClass = "border-amber-500/50 text-amber-600 dark:border-amber-400/50 dark:text-amber-400";
  else if (task.status === "W")
    badgeClass = "border-rose-500/50 text-rose-600 dark:border-rose-400/50 dark:text-rose-400";

  return `
    <tr>
      <td>
        <div class="ml-5 flex items-center gap-2 flex-wrap">
          <input type="text" class="font-semibold bg-transparent border-0 outline-none shadow-none focus:ring-0 focus:bg-zinc-100 dark:focus:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded px-1 py-0.5 h-auto leading-tight transition-colors m-0 cursor-text max-w-full" style="width: ${Math.max(safeTaskName.length + 1, 5)}ch;" value="${safeTaskName}" oninput="this.style.width = (this.value.length + 1) + 'ch';" onchange="handleInlineNameEdit(${i}, ${j}, this.value)" onfocus="this.select()" title="Edit Task Name">
          <button onclick="openTaskLabourDropdown(event, ${i}, ${j})" class="p-1 bg-transparent border-0 shadow-none hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors text-zinc-600 dark:text-zinc-400 focus:outline-none flex items-center justify-center cursor-pointer shrink-0" title="Assign Labour Codes">
            ${ICONS.labour}
          </button>
          ${renderTags(task.labourTags || [], "labour", "task", i, j, "xs")}
        </div>
      </td>
      <td class="text-center whitespace-nowrap align-top pt-1.5">
        <input type="text" class="font-mono tabular-nums text-sm text-center mx-auto py-1 px-1 h-auto leading-none bg-transparent border-0 outline-none shadow-none focus:ring-0 focus:bg-zinc-100 dark:focus:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors m-0 cursor-text" style="width: ${Math.max(durationValue.length + 1, 3)}ch;" value="${durationValue}" oninput="this.style.width = (this.value.length + 1) + 'ch';" onchange="handleInlineDurationEdit(${i}, ${j}, this.value)" onfocus="this.select()" title="Edit Duration">
      </td>
      <td class="text-center whitespace-nowrap align-top pt-1.5">
        <button type="button" onclick="openStatusModal(event, ${i}, ${j})" class="outline-none inline-block px-2 py-0.5 rounded border bg-transparent text-xs font-bold cursor-pointer text-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${badgeClass}" title="Change Status">
          ${task.status}
        </button>
      </td>
      <td class="text-center whitespace-nowrap align-top pt-1.5">
        <div class="flex gap-1.5 justify-center">
          <button onclick="insertTask(${i}, ${j})" class="btn btn-outline-secondary p-1" title="Split Task">${ICONS.split}</button>
          <button onclick="deleteTask(${i}, ${j})" class="btn btn-outline-danger p-1" title="Delete Task">${ICONS.trash}</button>
        </div>
      </td>
    </tr>
    <tr class="insert-ghost-row" ondblclick="splitOperationAt(${i}, ${j})">
      <td colspan="4" class="ghost-cell">
        + Double-click to split operation
      </td>
    </tr>
  `;
};

const updateStickyOffsets = () => {
  const activeLoggingPanel = document.getElementById("activeLoggingPanel");
  const taskList = document.getElementById("taskList");
  if (!activeLoggingPanel || !taskList) return;

  const tableHeader = taskList.querySelector("thead");
  if (!tableHeader) return;

  const table = taskList.querySelector("table");
  if (!table) return;

  const scrollContainer = taskList.closest(".overflow-y-auto");
  if (!scrollContainer) return;

  const scrollContainerRect = scrollContainer.getBoundingClientRect();
  const tableRect = table.getBoundingClientRect();

  const trs = table.querySelectorAll("tr");
  const lastRow = trs.length > 0 ? trs[trs.length - 1] : null;
  const lastRowBottom = lastRow ? lastRow.getBoundingClientRect().bottom : tableRect.bottom;
  const tableBottom = lastRowBottom - scrollContainerRect.top;

  const headerTop = activeLoggingPanel.offsetHeight;
  const opRows = taskList.querySelectorAll(".operation-row");
  const opRowTop = headerTop + tableHeader.offsetHeight;

  const firstOpRow = taskList.querySelector(".operation-row");
  const opRowHeight = firstOpRow ? firstOpRow.offsetHeight : 0;

  const footer = taskList.querySelector("#taskTableFoot");
  const footerTop = opRowTop + opRowHeight;
  const footerHeight = footer ? footer.offsetHeight : 0;

  // Shift only triggers once the full stack (header + opRow + footer) is compressed against the top
  const fullStackHeight = tableHeader.offsetHeight + opRowHeight + footerHeight;
  let shift = 0;
  if (tableBottom < headerTop + fullStackHeight) {
    shift = (headerTop + fullStackHeight) - tableBottom;
  }

  tableHeader.style.top = `${headerTop - shift}px`;

  opRows.forEach((row) => {
    const td = row.querySelector("td");
    if (td) {
      td.style.top = `${opRowTop - 1 - shift}px`;
      td.style.zIndex = "10";
    }
  });

  if (footer) {
    footer.style.top = `${footerTop - 1 - shift}px`;
  }
};

const updateTaskList = () => {
  try {
    if (!DOM.taskList) throw new Error("Task list element not found");
    const rows = [
      `<table class="table table-fixed w-full font-mono text-base tabular-nums [&_th]:align-middle [&_td]:align-middle [&_th]:text-sm sm:[&_th]:text-base [&_td]:text-sm sm:[&_td]:text-base [&_th]:py-1 [&_th]:h-5">
           <thead class="sticky z-20 bg-zinc-50 dark:bg-zinc-900 shadow-sm">
           <tr>
             <th scope="col" class="text-left align-middle w-auto pl-1 sm:pl-2">
               <div class="flex items-center gap-2">
                 <button onclick="toggleChartMode()" class="btn btn-sm btn-outline-secondary p-1 flex items-center justify-center" title="Toggle Chart View (Show ${chartMode === "column" ? "Gantt" : "Column"})">
                   ${chartMode === "column" ? ICONS.chartCol : ICONS.chartGantt}
                 </button>
                 <button onclick="toggleGroupingMode()" class="btn btn-sm btn-outline-secondary p-1 flex items-center justify-center" title="Toggle Grouping Mode (Show ${groupingMode === "lean" ? "Labour" : "Lean"})">
                   ${groupingMode === "lean" ? '<span class="w-4 h-4 flex items-center justify-center font-black text-sm leading-none">L</span>' : ICONS.labour}
                 </button>
                 <span>Operation</span>
               </div>
             </th>
             <th scope="col" class="text-center w-28 sm:w-32 whitespace-nowrap px-1">Duration</th>
             <th scope="col" class="text-center w-24 sm:w-28 whitespace-nowrap px-1">Status</th>
             <th scope="col" class="text-center w-20 sm:w-24 whitespace-nowrap pr-1 sm:pr-2">Actions</th>
           </tr>
         </thead>`,
    ];
    for (let i = 0; i < operations.length; i += 1) {
      rows.push(`<tbody class="operation-group">`);
      rows.push(buildOpRow(operations[i], i));
      for (let j = 0; j < operations[i].tasks.length; j += 1) {
        rows.push(buildTaskRow(operations[i].tasks[j], i, j));
      }
      rows.push(`</tbody>`);
    }
    rows.push(`
      </table>
      <div id="taskTableFoot" class="sticky z-20 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-[0_-2px_4px_rgba(0,0,0,0.05)] mt-[-1px] rounded-b-md"></div>
    `);
    DOM.taskList.innerHTML = rows.join("");

    DOM.taskTableFoot = document.getElementById("taskTableFoot");

    const table = DOM.taskList.querySelector("table");
    if (!table) throw new Error("Task table element not found");
    if (operations.length > 0) {
      table.style.display = "table";
      updateProcessTimes();
      addTaskButton.disabled = false;
    } else {
      table.style.display = "none";
      addTaskButton.disabled = true;
    }

    requestAnimationFrame(updateStickyOffsets);

    for (let i = 0; i < operations.length; i += 1) {
      const opTimeInput = document.getElementById(`opTimeInput-${i}`);
      if (!opTimeInput) throw new Error(`Operation time input opTimeInput-${i} not found`);
      opTimeInput.addEventListener("change", (event) => {
        const newTime = parseTimeFromHHMMSSMS(event.target.value);
        if (newTime !== null) {
          operations[i].startTime = newTime;
          toConsole(`Operation ${i} start time updated`, operations[i].startTime, debuggin);
          if (newTime < processStartTime) {
            showToast(`Operation "${operations[i].name}" starts before Process Start Time.`, "error");
          } else if (processEndTime > 0 && newTime > processEndTime) {
            showToast(`Operation "${operations[i].name}" starts after Process End Time.`, "error");
          }
          saveLocalState();
          updateProcessTimes();
          updateTaskList();
        } else {
          alert("Invalid time format. Please use HH:MM:SS.MS (e.g., 00:01:00.00).");
          opTimeInput.value = formatTimeToHHMMSSMS(operations[i].startTime);
        }
      });
    }

    if (typeof updateSliderTicks === "function") updateSliderTicks();
  } catch (error) {
    toConsole("updateTaskList error", error.message, debuggin);
    alert("Failed to update task list. Please check the console for details.");
  }
};

const updateProcessTimes = () => {
  try {
    if (operations.length === 0) return;

    if (!DOM.taskTableFoot) {
      toConsole("updateProcessTimes skipped", "taskTableFoot is null", debuggin);
      return;
    }

    const formattedStartTime = formatTimeToHHMMSSMS(processStartTime);
    const formattedEndTime = formatTimeToHHMMSSMS(processEndTime);
    let totalProcessTime = "00:00:00:00";
    if (operations.length > 0) {
      const durationSeconds = Math.max(0, processEndTime - processStartTime);
      totalProcessTime = formatTimeToHHMMSSMS(durationSeconds);
    }

    DOM.taskTableFoot.innerHTML = `
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

        const invalidOps = operations.filter((op) => op.startTime < processStartTime);
        if (invalidOps.length > 0) {
          invalidOps.forEach((op) => {
            showToast(`Operation "${op.name}" starts before Process Start Time.`, "error");
          });
        }

        const durationSeconds = Math.max(0, processEndTime - processStartTime);
        document.getElementById("totalProcessTimeInput").value = formatTimeToHHMMSSMS(durationSeconds);
        saveLocalState();
        if (typeof updateSliderTicks === "function") updateSliderTicks();
        if (typeof updateTaskList === "function") updateTaskList();
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

        const invalidOps = operations.filter((op) => op.startTime > processEndTime);
        if (invalidOps.length > 0) {
          invalidOps.forEach((op) => {
            showToast(`Operation "${op.name}" starts after Process End Time.`, "error");
          });
        }

        const durationSeconds = Math.max(0, processEndTime - processStartTime);
        document.getElementById("totalProcessTimeInput").value = formatTimeToHHMMSSMS(durationSeconds);
        saveLocalState();
        if (typeof updateSliderTicks === "function") updateSliderTicks();
        if (typeof updateTaskList === "function") updateTaskList();
      } else {
        alert("Invalid time format. Please use HH:MM:SS.MS (e.g., 00:01:00.00).");
        processEndTimeInput.value = formatTimeToHHMMSSMS(processEndTime);
      }
    });
  } catch (error) {
    toConsole("updateProcessTimes error", error.message, debuggin);
    alert("Failed to update process times. Please check the console for details.");
  }
};
