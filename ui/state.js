const debuggin = 1;
let videoFileName = "";
let videoFilePath = "";
let projectName = "";
let projectComments = "";
let masterParts = [];
let masterLabour = [];
let projectFilePath = "";
let projectFileHandle = null;
let videoQueue = [];
let activeQueueIndex = 0;
const videoBlobCache = {};
let operations = [];
let taktTime = 60000;
let preserveProcessTimes = false;
// biome-ignore lint/style/useConst: Global state modified in other scripts
let durationMode = "hhmmssms";
// biome-ignore lint/style/useConst: Global state modified in other scripts
let playerReady = false;
// biome-ignore lint/style/useConst: Global state modified in other scripts
let zoomLevel = 1;
// biome-ignore lint/style/useConst: Global state modified in other scripts
let translateX = 0;
// biome-ignore lint/style/useConst: Global state modified in other scripts
let translateY = 0;
let processStartTime = 0;
let processEndTime = 0;
let hourlyRate = 0;
let shiftLength = 480;
let targetEfficiency = 100;
let unitsPerCycle = 1;
let playbackSpeed = 1;
let volumeLevel = 1;
// biome-ignore lint/style/useConst: Global state modified in other scripts
let groupingMode = "lean";

const APP_VERSION = "0.1.0";

// biome-ignore lint/style/useConst: Global state modified in other scripts
let isDrawing = false;
let startX;
let startY;
let marqueeOverlay;
let marqueeRect;

// biome-ignore lint/style/useConst: Global state modified in other scripts
let currentStatusEdit = null;
// biome-ignore lint/style/useConst: Global state modified in other scripts
let currentOpContextIndex = null;

const DOM = {
  taskList: document.getElementById("taskList"),
  videoPlaceholder: document.getElementById("videoPlaceholder"),
  videoWrapper: document.getElementById("videoWrapper"),

  taskTableFoot: null, // Initialize as null, set dynamically in updateTaskList
  darkModeToggle: document.getElementById("darkModeToggle"),
  sunIcon: document.getElementById("sunIcon"),
  moonIcon: document.getElementById("moonIcon"),
  currentTime: document.getElementById("currentTime"),
  durationTime: document.getElementById("durationTime"),
  startGreyOut: document.getElementById("startGreyOut"),
  endGreyOut: document.getElementById("endGreyOut"),
  startTick: document.getElementById("startTick"),
  endTick: document.getElementById("endTick"),
  opTicksContainer: document.getElementById("opTicksContainer"),
  playIcon: document.getElementById("playIcon"),
  pauseIcon: document.getElementById("pauseIcon"),
  speedValue: document.getElementById("speedValue"),
  volumeOnIcon: document.getElementById("volumeOnIcon"),
  volumeOffIcon: document.getElementById("volumeOffIcon"),
  volumeValue: document.getElementById("volumeValue"),
  video: document.getElementById("my_video"),
  marqueeOverlay: document.getElementById("marqueeOverlay"),
  marqueeRect: document.getElementById("marqueeRect"),
  videoFileInput: document.getElementById("videoFileInput"),
  projectFileInput: document.getElementById("projectFileInput"),
  zoomIn: document.getElementById("zoomIn"),
  zoomOut: document.getElementById("zoomOut"),
  resetZoom: document.getElementById("resetZoom"),
  projectNameInput: document.getElementById("projectNameInput"),
  videoQueueSelect: document.getElementById("videoQueueSelect"),
  addVideoQueueBtn: document.getElementById("addVideoQueueBtn"),
  editVideoQueueBtn: document.getElementById("editVideoQueueBtn"),

  projectCommentsInput: document.getElementById("projectCommentsInput"),
  openSettingsBtn: document.getElementById("openSettingsBtn"),
  settingsBackdrop: document.getElementById("settingsBackdrop"),
  settingsPanel: document.getElementById("settingsPanel"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  hourlyRateInput: document.getElementById("hourlyRateInput"),
  shiftLengthInput: document.getElementById("shiftLengthInput"),
  targetEfficiencyInput: document.getElementById("targetEfficiencyInput"),
  unitsPerCycleInput: document.getElementById("unitsPerCycleInput"),
  taktTimeInput: document.getElementById("taktTimeInput"),
  partsFileInput: document.getElementById("partsFileInput"),
  labourFileInput: document.getElementById("labourFileInput"),
  partsUploadBtn: document.getElementById("partsUploadBtn"),
  labourUploadBtn: document.getElementById("labourUploadBtn"),
  partsViewBtn: document.getElementById("partsViewBtn"),
  labourViewBtn: document.getElementById("labourViewBtn"),
  masterDataModal: document.getElementById("masterDataModal"),
  masterDataModalTitle: document.getElementById("masterDataModalTitle"),
  masterDataList: document.getElementById("masterDataList"),
  clearMasterDataBtn: document.getElementById("clearMasterDataBtn"),
  closeMasterDataBtn: document.getElementById("closeMasterDataBtn"),
  closeMasterDataBtnX: document.getElementById("closeMasterDataBtnX"),
  statusModal: document.getElementById("statusModal"),
  timeContextMenu: document.getElementById("timeContextMenu"),
  setStartBtn: document.getElementById("setStartBtn"),
  setEndBtn: document.getElementById("setEndBtn"),
  opContextMenu: document.getElementById("opContextMenu"),
  opRenameBtn: document.getElementById("opRenameBtn"),
  opDeleteBtn: document.getElementById("opDeleteBtn"),
};

const saveLocalState = () => {
  if (!videoQueue[activeQueueIndex]) {
    videoQueue[activeQueueIndex] = {
      videoId: activeQueueIndex + 1,
      videoName: `Video ${activeQueueIndex + 1}`,
      costingConfig: {},
      appState: {},
    };
  }

  // Sync active global variables to the current video object
  videoQueue[activeQueueIndex].videoFileName = videoFileName;
  videoQueue[activeQueueIndex].videoFilePath = videoFilePath;
  videoQueue[activeQueueIndex].processStartTime = processStartTime;
  videoQueue[activeQueueIndex].processEndTime = processEndTime;
  videoQueue[activeQueueIndex].taktTime = taktTime;
  videoQueue[activeQueueIndex].costingConfig = { hourlyRate, shiftLength, targetEfficiency, unitsPerCycle };
  videoQueue[activeQueueIndex].appState = { operations };

  const state = {
    projectMeta: {
      projectName,
      projectComments,
      masterParts,
      masterLabour,
      lastSaved: new Date().toISOString(),
      appVersion: APP_VERSION,
    },
    appConfig: {
      playbackSpeed,
      volumeLevel,
    },
    videoQueue,
    activeQueueIndex,
  };

  localStorage.setItem("timeStudyData", JSON.stringify(state));
};

const loadLocalState = () => {
  const data = localStorage.getItem("timeStudyData");
  if (data) {
    try {
      const state = JSON.parse(data);

      if (state.projectMeta) {
        masterParts = state.projectMeta.masterParts || [];
        masterLabour = state.projectMeta.masterLabour || [];
      } else {
        masterParts = state.masterParts || [];
        masterLabour = state.masterLabour || [];
      }

      if (state.appConfig) {
        playbackSpeed = state.appConfig.playbackSpeed !== undefined ? state.appConfig.playbackSpeed : 1;
        volumeLevel = state.appConfig.volumeLevel !== undefined ? state.appConfig.volumeLevel : 1;
      } else {
        playbackSpeed = state.playbackSpeed !== undefined ? state.playbackSpeed : 1;
        volumeLevel = state.volumeLevel !== undefined ? state.volumeLevel : 1;
      }

      toConsole("Global settings and master data restored", "Success", debuggin);
    } catch (e) {
      toConsole("Error parsing local state", e, debuggin);
    }
  }

  // Always initialize a blank video queue item for a fresh project
  projectFilePath = "";
  projectName = "";
  projectComments = "";
  videoQueue = [
    {
      videoId: 1,
      videoName: "Video 1",
      videoFileName: "",
      videoFilePath: "",
      processStartTime: 0,
      processEndTime: 0,
      taktTime: 60000,
      costingConfig: { hourlyRate: 0, shiftLength: 480, targetEfficiency: 100, unitsPerCycle: 1 },
      appState: { operations: [] },
    },
  ];
  activeQueueIndex = 0;

  // Hydrate memory with the active video data (the blank one)
  const currentVideo = videoQueue[activeQueueIndex];
  videoFileName = currentVideo.videoFileName || "";
  videoFilePath = currentVideo.videoFilePath || "";
  processStartTime = currentVideo.processStartTime || 0;
  processEndTime = currentVideo.processEndTime || 0;
  taktTime = currentVideo.taktTime || 60000;

  hourlyRate = currentVideo.costingConfig?.hourlyRate || 0;
  shiftLength = currentVideo.costingConfig?.shiftLength || 480;
  targetEfficiency = currentVideo.costingConfig?.targetEfficiency || 100;
  unitsPerCycle = currentVideo.costingConfig?.unitsPerCycle || 1;

  operations = currentVideo.appState?.operations || [];

  // Sync UI
  if (DOM.projectNameInput) DOM.projectNameInput.value = projectName;
  if (typeof renderVideoQueueSelect === "function") renderVideoQueueSelect();
};

const exportToJSON = async (isSaveAs = false) => {
  saveLocalState(); // Force sync of globals to current video before export
  const dataStr = localStorage.getItem("timeStudyData");
  if (!dataStr) return;

  let formattedDataStr = dataStr;
  try {
    formattedDataStr = JSON.stringify(JSON.parse(dataStr), null, 2);
  } catch (e) {
    toConsole("Error formatting JSON data for export", e, debuggin);
  }

  let filename = "project.tmv";
  if (projectName) {
    filename = `${sanitizeFilename(projectName)}.tmv`;
  }

  const isTauri = window.__TAURI__ !== undefined;
  if (isTauri) {
    try {
      if (isSaveAs === true || !projectFilePath) {
        const defaultName = projectFilePath ? projectFilePath.split(/[/\\]/).pop() : filename;
        const filePath = await window.__TAURI__.dialog.save({
          filters: [{ name: "TMVideo Project", extensions: ["tmv"] }],
          defaultPath: defaultName,
        });
        if (filePath) {
          projectFilePath = typeof filePath === "object" ? filePath.path : filePath;
          localStorage.setItem("projectFilePath", projectFilePath);
          await window.__TAURI__.fs.writeTextFile(projectFilePath, formattedDataStr);
          showToast("Project saved successfully.", "success");
        }
      } else {
        await window.__TAURI__.fs.writeTextFile(projectFilePath, formattedDataStr);
        showToast("Project saved successfully.", "success");
      }
    } catch (e) {
      toConsole("Error saving project via Tauri", e, debuggin);
      showToast("Error saving project file.", "error");
    }
  } else {
    if (window.showSaveFilePicker) {
      try {
        if (isSaveAs === true || !projectFileHandle) {
          projectFileHandle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [
              {
                description: "TMVideo Project",
                accept: { "application/json": [".tmv"] },
              },
            ],
          });
        }
        const writable = await projectFileHandle.createWritable();
        await writable.write(formattedDataStr);
        await writable.close();
        showToast("Project saved successfully.", "success");
        return;
      } catch (err) {
        if (err.name !== "AbortError") {
          toConsole("Error with showSaveFilePicker", err, debuggin);
        } else {
          return; // User cancelled the prompt
        }
      }
    }

    // Fallback for older browsers
    const blob = new Blob([formattedDataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Project saved successfully.", "success");
  }
};

const importFromJSON = (jsonText) => {
  try {
    preserveProcessTimes = true;
    const data = JSON.parse(jsonText);

    if (data.videoQueue) {
      videoQueue = data.videoQueue;
      activeQueueIndex = data.activeQueueIndex || 0;
      projectName = data.projectMeta?.projectName || "";
      projectComments = data.projectMeta?.projectComments || "";
      masterParts = data.projectMeta?.masterParts || [];
      masterLabour = data.projectMeta?.masterLabour || [];
    } else {
      alert("Invalid project file format.");
      return;
    }

    // Load active video into memory
    const currentVideo = videoQueue[activeQueueIndex];
    videoFileName = currentVideo.videoFileName || "";
    videoFilePath = currentVideo.videoFilePath || "";
    processStartTime = currentVideo.processStartTime || 0;
    processEndTime = currentVideo.processEndTime || 0;
    taktTime = currentVideo.taktTime || 60000;

    hourlyRate = currentVideo.costingConfig?.hourlyRate || 0;
    shiftLength = currentVideo.costingConfig?.shiftLength || 480;
    targetEfficiency = currentVideo.costingConfig?.targetEfficiency || 100;
    unitsPerCycle = currentVideo.costingConfig?.unitsPerCycle || 1;

    operations = currentVideo.appState?.operations || [];

    if (DOM.projectNameInput) DOM.projectNameInput.value = projectName;
    if (typeof renderVideoQueueSelect === "function") renderVideoQueueSelect();

    DOM.taskList.innerHTML = "";

    // Handle Video Relinking
    player.pause();
    const isTauri = window.__TAURI__ !== undefined;
    if (isTauri && videoFilePath) {
      const tauriAssetUrl = window.__TAURI__.core.convertFileSrc(videoFilePath);
      player.src = tauriAssetUrl;
      player.preload = "auto";
      toggleVideoPlaceholder(false);
    } else if (videoFileName && videoBlobCache[videoFileName]) {
      player.src = videoBlobCache[videoFileName];
      player.preload = "metadata";
      toggleVideoPlaceholder(false);
    } else {
      player.src = "";
      player.removeAttribute("src");
      DOM.videoPlaceholder.textContent = videoFileName
        ? `Project loaded. Click here to locate video: ${videoFileName}`
        : "Load a video to get started";
      toggleVideoPlaceholder(true);
    }

    if (typeof updateTaskList === "function") updateTaskList();
    saveLocalState();
    if (typeof drawTable === "function") drawTable();
    if (typeof updateLoadButtonColor === "function") updateLoadButtonColor();

    toConsole("Project imported successfully", `Loaded Video: ${currentVideo.videoName}`, debuggin);
    showToast("Project loaded successfully.", "success");
  } catch (e) {
    toConsole("Error importing JSON", e, debuggin);
    alert(`Error reading project file. It may be corrupted or in an invalid format. Details: ${e.message || e}`);
  }
};

const parsePartTag = (tagStr) => {
  let qty = "";
  let partStr = tagStr;
  const xIdx = tagStr.indexOf(" x ");
  if (xIdx !== -1) {
    qty = tagStr.substring(0, xIdx).trim();
    partStr = tagStr.substring(xIdx + 3).trim();
  }
  let partNumber = partStr;
  let partDescription = "";
  const dashIdx = partStr.indexOf(" - ");
  if (dashIdx !== -1) {
    partNumber = partStr.substring(0, dashIdx).trim();
    partDescription = partStr.substring(dashIdx + 3).trim();
  }
  return { qty, partNumber, partDescription };
};

const parseLabourTag = (tagStr) => {
  let code = tagStr;
  let description = "";
  const dashIdx = tagStr.indexOf(" - ");
  if (dashIdx !== -1) {
    code = tagStr.substring(0, dashIdx).trim();
    description = tagStr.substring(dashIdx + 3).trim();
  }
  return { code, description };
};

const formatDurationForExport = (ms) => {
  if (durationMode === "hhmmssms") {
    return formatDuration(ms);
  } else if (durationMode === "ms") {
    return ms.toFixed(0);
  } else {
    return (ms / 60000).toFixed(3);
  }
};

const formatZeroDuration = () => {
  if (durationMode === "hhmmssms") return "00:00:00.00";
  if (durationMode === "ms") return "0";
  return "0.00";
};

const escapeCSV = (val) => {
  if (val === undefined || val === null) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const exportToCSV = async () => {
  if (operations.length === 0) {
    alert("No operations or tasks to export.");
    return;
  }

  const currentVideo = videoQueue[activeQueueIndex] || {};
  const videoNameVal = currentVideo.videoName || "";

  let csvContent = "";

  // 1. Metadata Block
  // Row 1: Titles
  csvContent += "Project Name,Video Name,Process Start Time,Process End Time,Takt Time,Video File Name\n";
  // Row 2: Values
  csvContent += `${escapeCSV(projectName)},${escapeCSV(videoNameVal)},${formatTimeToHHMMSSMS(processStartTime)},${formatTimeToHHMMSSMS(processEndTime)},${formatDurationForExport(taktTime)},${escapeCSV(videoFileName)}\n`;
  // Row 3: Blank
  csvContent += "\n";

  // 2. Operations & Tasks Loop
  for (let i = 0; i < operations.length; i += 1) {
    const op = operations[i];
    const opTotalTime = op.tasks.reduce((sum, t) => sum + t.duration, 0);

    // Operation Titles
    csvContent +=
      "Operation Name,Operation Part Qty,Operation Part Numbers,Operation Part Description,Operation Start Time,Operation Total Time\n";

    // Operation Values
    const partTags = op.partTags || [];
    if (partTags.length === 0) {
      csvContent += `${escapeCSV(op.name)},,,,${formatTimeToHHMMSSMS(op.startTime)},${formatDecimalMinutes(opTotalTime)}\n`;
    } else {
      for (let pIdx = 0; pIdx < partTags.length; pIdx += 1) {
        const { qty, partNumber, partDescription } = parsePartTag(partTags[pIdx]);
        if (pIdx === 0) {
          csvContent += `${escapeCSV(op.name)},${escapeCSV(qty)},${escapeCSV(partNumber)},${escapeCSV(partDescription)},${formatTimeToHHMMSSMS(op.startTime)},${formatDecimalMinutes(opTotalTime)}\n`;
        } else {
          csvContent += `,${escapeCSV(qty)},${escapeCSV(partNumber)},${escapeCSV(partDescription)},,\n`;
        }
      }
    }

    // Task Titles
    csvContent += "Task Name,Task Labour Code,Task Labour Description,VA,NVA,W,Total Task Time\n";

    // Task Values
    for (let j = 0; j < op.tasks.length; j += 1) {
      const task = op.tasks[j];
      const status = task.status.toUpperCase();
      const laborTags = task.labourTags || [];

      const valVA = status === "VA" ? formatDecimalMinutes(task.duration) : "0.00";
      const valNVA = status === "NVA" ? formatDecimalMinutes(task.duration) : "0.00";
      const valW = status === "W" ? formatDecimalMinutes(task.duration) : "0.00";
      const valTotal = formatDecimalMinutes(task.duration);

      if (laborTags.length === 0) {
        csvContent += `${escapeCSV(task.name)},,,${valVA},${valNVA},${valW},${valTotal}\n`;
      } else {
        for (let lIdx = 0; lIdx < laborTags.length; lIdx += 1) {
          const { code, description } = parseLabourTag(laborTags[lIdx]);
          if (lIdx === 0) {
            csvContent += `${escapeCSV(task.name)},${escapeCSV(code)},${escapeCSV(description)},${valVA},${valNVA},${valW},${valTotal}\n`;
          } else {
            csvContent += `,${escapeCSV(code)},${escapeCSV(description)},,,,\n`;
          }
        }
      }
    }

    // Blank row after each Operation block
    csvContent += "\n";
  }

  let filename = "operation_task_durations.csv";
  if (projectName) {
    filename = `${sanitizeFilename(projectName)}.csv`;
  }

  const isTauri = window.__TAURI__ !== undefined;
  if (isTauri) {
    try {
      const filePath = await window.__TAURI__.dialog.save({
        filters: [{ name: "CSV", extensions: ["csv"] }],
        defaultPath: filename,
      });
      if (filePath) {
        const actualPath = typeof filePath === "object" ? filePath.path : filePath;
        await window.__TAURI__.fs.writeTextFile(actualPath, csvContent);
        showToast("Data exported to CSV successfully.", "success");
      }
    } catch (e) {
      toConsole("Error exporting CSV via Tauri", e, debuggin);
      showToast("Error exporting CSV file.", "error");
    }
  } else {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Data exported to CSV successfully.", "success");
  }
};

