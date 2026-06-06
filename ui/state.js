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
let markers = [];
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
let playbackSpeed = 1;
let volumeLevel = 1;
// biome-ignore lint/style/useConst: Global state modified in other scripts
let groupingMode = "lean";

const APP_VERSION = "0.2.5";

// biome-ignore lint/style/useConst: Global state modified in other scripts
let isDrawing = false;
let startX;
let startY;
let marqueeOverlay;
let marqueeRect;

const DOM = {
  markersList: document.getElementById("markersList"),
  videoPlaceholder: document.getElementById("videoPlaceholder"),
  videoWrapper: document.getElementById("video-wrapper-id"),

  darkModeToggle: document.getElementById("darkModeToggle"),
  sunIcon: document.getElementById("sunIcon"),
  moonIcon: document.getElementById("moonIcon"),
  currentTime: document.getElementById("currentTime"),
  durationTime: document.getElementById("durationTime"),
  startGreyOut: document.getElementById("startGreyOut"),
  endGreyOut: document.getElementById("endGreyOut"),
  startTick: document.getElementById("startTick"),
  endTick: document.getElementById("endTick"),
  markerTicksContainer: document.getElementById("markerTicksContainer"),
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
  takeSnapshotBtn: document.getElementById("takeSnapshotBtn"),
  toggleCinemaBtn: document.getElementById("toggleCinemaBtn"),
  projectNameInput: document.getElementById("projectNameInput"),
  videoQueueSelect: document.getElementById("videoQueueSelect"),
  addVideoQueueBtn: document.getElementById("addVideoQueueBtn"),
  editVideoQueueBtn: document.getElementById("editVideoQueueBtn"),

  projectCommentsInput: document.getElementById("projectCommentsInput"),
  openSettingsBtn: document.getElementById("openSettingsBtn"),
  settingsBackdrop: document.getElementById("settingsBackdrop"),
  settingsPanel: document.getElementById("settingsPanel"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  masterDataModal: document.getElementById("masterDataModal"),
  masterDataModalTitle: document.getElementById("masterDataModalTitle"),
  masterDataList: document.getElementById("masterDataList"),
  clearMasterDataBtn: document.getElementById("clearMasterDataBtn"),
  closeMasterDataBtn: document.getElementById("closeMasterDataBtn"),
  closeMasterDataBtnX: document.getElementById("closeMasterDataBtnX"),
};

const saveLocalState = () => {
  if (!videoQueue[activeQueueIndex]) {
    videoQueue[activeQueueIndex] = {
      videoId: activeQueueIndex + 1,
      videoName: `Video ${activeQueueIndex + 1}`,
      appState: {},
    };
  }

  // Sync active global variables to the current video object
  videoQueue[activeQueueIndex].videoFileName = videoFileName;
  videoQueue[activeQueueIndex].videoFilePath = videoFilePath;
  videoQueue[activeQueueIndex].processStartTime = processStartTime;
  videoQueue[activeQueueIndex].processEndTime = processEndTime;
  videoQueue[activeQueueIndex].appState = { markers };

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
  let restored = false;

  if (data) {
    try {
      const state = JSON.parse(data);

      if (state.projectMeta) {
        masterParts = state.projectMeta.masterParts || [];
        masterLabour = state.projectMeta.masterLabour || [];
        projectName = state.projectMeta.projectName || "";
        projectComments = state.projectMeta.projectComments || "";
      } else {
        masterParts = state.masterParts || [];
        masterLabour = state.masterLabour || [];
        projectName = "";
        projectComments = "";
      }

      if (state.appConfig) {
        playbackSpeed = state.appConfig.playbackSpeed !== undefined ? state.appConfig.playbackSpeed : 1;
        volumeLevel = state.appConfig.volumeLevel !== undefined ? state.appConfig.volumeLevel : 1;
      } else {
        playbackSpeed = state.playbackSpeed !== undefined ? state.playbackSpeed : 1;
        volumeLevel = state.volumeLevel !== undefined ? state.volumeLevel : 1;
      }

      if (state.videoQueue && state.videoQueue.length > 0) {
        videoQueue = state.videoQueue;
        activeQueueIndex = state.activeQueueIndex || 0;
      } else {
        videoQueue = [
          {
            videoId: 1,
            videoName: "Video 1",
            videoFileName: "",
            videoFilePath: "",
            processStartTime: 0,
            processEndTime: 0,
            appState: { markers: [] },
          },
        ];
        activeQueueIndex = 0;
      }

      projectFilePath = localStorage.getItem("projectFilePath") || "";
      restored = true;
      toConsole("Global settings and master data restored", "Success", debuggin);
    } catch (e) {
      toConsole("Error parsing local state", e, debuggin);
    }
  }

  if (!restored) {
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
        appState: { markers: [] },
      },
    ];
    activeQueueIndex = 0;
  }

  // Hydrate memory with the active video data
  const currentVideo = videoQueue[activeQueueIndex];
  videoFileName = currentVideo.videoFileName || "";
  videoFilePath = currentVideo.videoFilePath || "";
  processStartTime = currentVideo.processStartTime || 0;
  processEndTime = currentVideo.processEndTime || 0;

  markers = currentVideo.appState?.markers || [];
  for (const m of markers) {
    if (!m.type) m.type = "standard";
  }

  // Sync UI
  if (DOM.projectNameInput) DOM.projectNameInput.value = projectName;
  if (typeof renderVideoQueueSelect === "function") renderVideoQueueSelect();

  if (videoQueue && videoQueue.length > 0) {
    const currentVideo = videoQueue[activeQueueIndex];
    if (currentVideo && currentVideo.videoFilePath) {
      const isTauri = window.TAURI !== undefined || window.__TAURI__ !== undefined;
      const tauriObj = window.TAURI || window.__TAURI__;
      if (isTauri && tauriObj && tauriObj.core && tauriObj.core.convertFileSrc) {
        const assetUrl = tauriObj.core.convertFileSrc(currentVideo.videoFilePath);
        player.src = assetUrl;
        player.preload = "auto";
        toggleVideoPlaceholder(false);
        player.load();

        if (typeof window.loadSubtitleTrack === "function") {
          window.loadSubtitleTrack(currentVideo.videoFilePath);
        }
      }
    }
  }
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
  if (typeof window.resetVideoViewport === "function") {
    window.resetVideoViewport(player);
  }
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

    markers = currentVideo.appState?.markers || [];
    for (const m of markers) {
      if (!m.type) m.type = "standard";
    }

    if (DOM.projectNameInput) DOM.projectNameInput.value = projectName;
    if (typeof renderVideoQueueSelect === "function") renderVideoQueueSelect();

    DOM.markersList.innerHTML = "";

    // Handle Video Relinking
    if (typeof window.resetClosedCaptions === "function") {
      window.resetClosedCaptions();
    }
    player.pause();
    const isTauri = window.__TAURI__ !== undefined;
    if (isTauri && videoFilePath) {
      const tauriAssetUrl = window.__TAURI__.core.convertFileSrc(videoFilePath);
      player.src = tauriAssetUrl;
      player.preload = "auto";
      toggleVideoPlaceholder(false);
      if (typeof window.loadSubtitleTrack === "function") {
        window.loadSubtitleTrack(videoFilePath);
      }
    } else if (videoFileName && videoBlobCache[videoFileName]) {
      player.src = videoBlobCache[videoFileName];
      player.preload = "metadata";
      toggleVideoPlaceholder(false);
      const ccTrack = document.getElementById("ccTrack");
      if (ccTrack) ccTrack.src = "";
    } else {
      player.src = "";
      player.removeAttribute("src");
      DOM.videoPlaceholder.textContent = videoFileName
        ? `Project loaded. Click here to locate video: ${videoFileName}`
        : "Load a video to get started";
      toggleVideoPlaceholder(true);
    }

    if (typeof updateMarkersList === "function") updateMarkersList();
    if (typeof drawTable === "function") drawTable();
    if (typeof updateLoadButtonColor === "function") updateLoadButtonColor();

    toConsole("Project imported successfully", `Loaded Video: ${currentVideo.videoName}`, debuggin);
    showToast("Project loaded successfully.", "success");
    saveLocalState();
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
  if (markers.length === 0) {
    alert("No markers to export.");
    return;
  }

  const currentVideo = videoQueue[activeQueueIndex] || {};
  const videoNameVal = currentVideo.videoName || "";

  let csvContent = "";

  // 1. Metadata Block
  // Row 1: Titles
  csvContent += "Project Name,Video Name,Process Start Time,Process End Time,Video File Name\n";
  // Row 2: Values
  csvContent += `${escapeCSV(projectName)},${escapeCSV(videoNameVal)},${formatTimeToHHMMSSMS(processStartTime)},${formatTimeToHHMMSSMS(processEndTime)},${escapeCSV(videoFileName)}\n`;
  // Row 3: Blank
  csvContent += "\n";

  // 2. Markers List
  csvContent += "Marker ID,Marker Name,Start Time,Duration (seconds)\n";
  for (let i = 0; i < markers.length; i += 1) {
    const marker = markers[i];
    let duration = 0;
    if (i < markers.length - 1) {
      duration = markers[i + 1].startTime - marker.startTime;
    } else if (typeof player !== "undefined" && player && player.duration) {
      duration = player.duration - marker.startTime;
    }
    duration = Math.max(0, duration);
    csvContent += `${marker.id || i + 1},${escapeCSV(marker.name)},${formatTimeToHHMMSSMS(marker.startTime)},${duration.toFixed(3)}\n`;
  }

  let filename = "markers.csv";
  if (projectName) {
    filename = `${sanitizeFilename(projectName)}_markers.csv`;
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
