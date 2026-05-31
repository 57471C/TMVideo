const appWindow = window.__TAURI__ ? window.__TAURI__.window.appWindow : null;
let isCinemaMode = false;
let player;
let loadVideoButton;
let addMarkerBtn;
let toggleFormatButton;
let exportButton;
let projectExportButton;
let projectSaveAsButton;
let projectImportButton;
let newProjectButton;
let speedSlider;
let seekBar;
let playPauseButton;
let jumpToStartButton;
let rewind5sButton;
let rewind1sButton;
let forward1sButton;
let forward5sButton;
let muteButton;
let volumeSlider;
let activeFFmpegChild = null;
let isAborted = false;

const renderVideoQueueSelect = () => {
  if (!DOM.videoQueueSelect) return;
  DOM.videoQueueSelect.innerHTML = "";
  for (const [index, video] of videoQueue.entries()) {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = video.videoName;
    option.className = "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white";
    if (index === activeQueueIndex) {
      option.selected = true;
    }
    DOM.videoQueueSelect.appendChild(option);
  }
};

const switchVideoInQueue = async (index) => {
  if (index === activeQueueIndex) return;

  preserveProcessTimes = true;
  saveLocalState();

  activeQueueIndex = index;
  const currentVideo = videoQueue[activeQueueIndex];

  videoFileName = currentVideo.videoFileName || "";
  videoFilePath = currentVideo.videoFilePath || "";
  processStartTime = currentVideo.processStartTime || 0;
  processEndTime = currentVideo.processEndTime || 0;

  markers = currentVideo.appState?.markers || [];
  for (const m of markers) {
    if (!m.type) m.type = "standard";
  }

  renderVideoQueueSelect();
  updateMarkersList();

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
      ? `Video switched. Click here to locate video: ${videoFileName}`
      : "Load a video to get started";
    toggleVideoPlaceholder(true);
  }
  updateLoadButtonColor();

  if (!DOM.settingsPanel.classList.contains("translate-x-full")) {
    toggleSettings(true);
  }

  showToast(`Switched to: ${currentVideo.videoName}`, "success");
  updateSliderTicks();
};

const addVideoToQueue = async () => {
  const videoName = await asyncPrompt("Enter a name for the new video:", `Video ${videoQueue.length + 1}`, "New Video");
  if (!videoName) return;
  const duplicate = await asyncConfirm(
    "Would you like to duplicate the current video's tasks and video? (Click 'Cancel' to create a blank video slot)",
    "Duplicate Data?",
  );

  saveLocalState();
  const newVideoId = videoQueue.length > 0 ? Math.max(...videoQueue.map((v) => v.videoId)) + 1 : 1;

  const newVideo = duplicate
    ? { ...JSON.parse(JSON.stringify(videoQueue[activeQueueIndex])), videoId: newVideoId, videoName }
    : {
        videoId: newVideoId,
        videoName,
        videoFileName: "",
        videoFilePath: "",
        processStartTime: 0,
        processEndTime: 0,
        appState: { markers: [] },
      };

  videoQueue.push(newVideo);
  await switchVideoInQueue(videoQueue.length - 1);
};

const editVideoInQueue = async () => {
  const currentName = videoQueue[activeQueueIndex].videoName;
  const newName = await asyncPrompt("Rename Video:", currentName, "Edit Video Name");
  if (!newName || newName.trim() === "") return;

  videoQueue[activeQueueIndex].videoName = newName.trim();
  saveLocalState();
  renderVideoQueueSelect();
  showToast("Video renamed successfully.", "success");
};

const processNewVideoFile = async (fileOrPath, isTauriPath = false) => {
  const currentSrc = player.getAttribute("src");
  const hasExistingVideo = currentSrc && currentSrc !== "";

  if (hasExistingVideo && markers.length > 0) {
    const save = await asyncConfirm(
      "You have unsaved data. Would you like to save your project before loading a new video?",
      "Unsaved Data",
    );
    if (save) {
      await exportToJSON(false);
      toConsole("Project saved before loading new video", null, debuggin);
    }
    const proceed = await asyncConfirm(
      "Loading a new video will clear all existing data. Are you sure you want to proceed?",
      "Load New Video",
    );
    if (!proceed) {
      toConsole("User cancelled loading new video", null, debuggin);
      return;
    }
  }

  const isRelinking = !hasExistingVideo && (markers.length > 0 || projectName !== "");

  if (isTauriPath) {
    const filePath = typeof fileOrPath === "object" ? fileOrPath.path : fileOrPath;
    videoFileName = typeof fileOrPath === "object" && fileOrPath.name ? fileOrPath.name : filePath.split(/[/\\]/).pop();
    videoFilePath = filePath;

    const tauriAssetUrl = window.__TAURI__.core.convertFileSrc(videoFilePath);
    player.src = tauriAssetUrl;
    player.preload = "auto";
  } else {
    const file = fileOrPath;
    videoFileName = file.name;
    videoFilePath = file.path || ""; // Tauri injects the absolute path here

    const isTauri = window.__TAURI__ !== undefined;
    if (isTauri && videoFilePath) {
      const tauriAssetUrl = window.__TAURI__.core.convertFileSrc(videoFilePath);
      player.src = tauriAssetUrl;
      player.preload = "auto";
    } else {
      const fileURL = URL.createObjectURL(file);
      videoBlobCache[videoFileName] = fileURL;
      player.src = fileURL;
      player.preload = "metadata";
    }
  }

  player.load();

  if (!isRelinking) {
    markers = [];
    projectName = "";
    if (DOM.projectNameInput) {
      DOM.projectNameInput.value = "";
    }
    updateMarkersList();
    toConsole("Cleared all previous data", null, debuggin);
  } else {
    toConsole("Re-linked video to existing project", videoFileName, debuggin);
  }

  DOM.videoPlaceholder.textContent = "Load a video to get started";
  saveLocalState();
  updateSliderTicks();

  updateLoadButtonColor();
};

const takeSnapshot = () => {
  if (!player || !player.src) {
    showToast("No video loaded.", "error");
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = player.videoWidth;
  canvas.height = player.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(player, 0, 0, canvas.width, canvas.height);

  try {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const link = document.createElement("a");
    const currentTimeStr = player.currentTime.toFixed(2).replace(".", "_");
    link.download = `snapshot_${currentTimeStr}.jpg`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Snapshot saved.", "success");
  } catch (error) {
    toConsole("Failed to take snapshot", error, debuggin);
    showToast("Error taking snapshot.", "error");
  }
};

async function toggleCinemaMode() {
  isCinemaMode = !isCinemaMode;

  // 1. Toggle DOM classes for layout shift
  document.body.classList.toggle("cinema-active", isCinemaMode);

  // 2. Handle Monitor Fullscreen
  const appWindow = window.__TAURI__ ? window.__TAURI__.window.appWindow : null;
  if (appWindow) {
    try {
      await appWindow.setFullscreen(isCinemaMode);
    } catch (e) {
      toConsole("Error setting fullscreen via Tauri", e, debuggin);
    }
  } else {
    if (isCinemaMode && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen().catch((e) => console.warn(e));
    } else if (document.exitFullscreen) {
      await document.exitFullscreen();
    }
  }
  toConsole("Cinema mode toggled", isCinemaMode, debuggin);
}

const initializePlayer = () => {
  player = DOM.video;
  player.preservesPitch = true;
  playerReady = true;
  toConsole("Video element initialized", "Success", debuggin);
  toConsole("App Version", APP_VERSION, debuggin);

  marqueeOverlay = DOM.marqueeOverlay;
  marqueeRect = DOM.marqueeRect;

  const activeLoggingPanel = document.getElementById("activeLoggingPanel");
  if (activeLoggingPanel) {
    new ResizeObserver(() => {
      if (typeof updateStickyOffsets === "function") {
        updateStickyOffsets();
      }
    }).observe(activeLoggingPanel);
  }

  const isDarkMode = localStorage.getItem("darkMode") === "true";

  if (isDarkMode) {
    document.documentElement.classList.add("dark");
    DOM.sunIcon.classList.add("hidden");
    DOM.moonIcon.classList.remove("hidden");
  } else {
    document.documentElement.classList.remove("dark");
    DOM.sunIcon.classList.remove("hidden");
    DOM.moonIcon.classList.add("hidden");
  }

  DOM.darkModeToggle.addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    const isDark = document.documentElement.classList.contains("dark");
    DOM.sunIcon.classList.toggle("hidden", isDark);
    DOM.moonIcon.classList.toggle("hidden", !isDark);
    localStorage.setItem("darkMode", isDark);
    toConsole("Dark mode toggled", isDark ? "On" : "Off", debuggin);

    updateMarkersList();
  });

  if (DOM.videoQueueSelect) {
    DOM.videoQueueSelect.addEventListener("change", (e) => {
      switchVideoInQueue(Number.parseInt(e.target.value, 10));
    });
  }
  if (DOM.addVideoQueueBtn) {
    DOM.addVideoQueueBtn.addEventListener("click", addVideoToQueue);
  }
  if (DOM.editVideoQueueBtn) {
    DOM.editVideoQueueBtn.addEventListener("click", editVideoInQueue);
  }

  if (DOM.projectNameInput) {
    DOM.projectNameInput.addEventListener("blur", (e) => {
      e.target.value = sanitizeFilename(e.target.value);
      projectName = e.target.value;
      saveLocalState();
    });
    DOM.projectNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.target.blur();
      }
    });
  }

  // Settings Panel Logic
  if (DOM.openSettingsBtn) {
    const saveSettingsData = () => {
      if (DOM.projectCommentsInput) projectComments = DOM.projectCommentsInput.value;
      saveLocalState();
      return true;
    };

    DOM.openSettingsBtn.addEventListener("click", () => toggleSettings(true));

    DOM.closeSettingsBtn.addEventListener("click", () => {
      saveSettingsData();
      toggleSettings(false);
    });

    DOM.settingsBackdrop.addEventListener("click", () => {
      saveSettingsData();
      toggleSettings(false);
    });

    const closeMasterModal = () => DOM.masterDataModal.close();
    if (DOM.closeMasterDataBtnX) DOM.closeMasterDataBtnX.addEventListener("click", closeMasterModal);
    if (DOM.closeMasterDataBtn) DOM.closeMasterDataBtn.addEventListener("click", closeMasterModal);
  }

  if (DOM.statusModal) {
    for (const btn of DOM.statusModal.querySelectorAll(".status-btn")) {
      btn.addEventListener("click", (e) => {
        if (currentStatusEdit) {
          handleInlineStatusEdit(
            currentStatusEdit.opIndex,
            currentStatusEdit.taskIndex,
            e.target.getAttribute("data-status"),
          );
        }
        DOM.statusModal.close();
        currentStatusEdit = null;
      });
    }
    DOM.statusModal.addEventListener("click", (e) => {
      if (e.target === DOM.statusModal) {
        DOM.statusModal.close();
        currentStatusEdit = null;
      }
    });
  }

  player.addEventListener("timeupdate", seektimeupdate);
  player.addEventListener("loadedmetadata", () => {
    const duration = player.duration;
    seekBar.max = duration;
    if (duration > 0) {
      let tickSeconds = 60;
      if (duration <= 15)
        tickSeconds = 2; // e.g. 10s video = 5 ticks
      else if (duration <= 30)
        tickSeconds = 5; // e.g. 25s video = 5 ticks
      else if (duration <= 60)
        tickSeconds = 10; // e.g. 50s video = 5 ticks
      else if (duration <= 180)
        tickSeconds = 30; // e.g. 2m video = 4 ticks
      else if (duration <= 300)
        tickSeconds = 60; // e.g. 4m video = 4 ticks
      else if (duration <= 600)
        tickSeconds = 120; // e.g. 8m video = 4 ticks
      else if (duration <= 1800)
        tickSeconds = 300; // e.g. 25m video = 5 ticks
      else tickSeconds = 600; // 10m intervals for anything longer

      const tickInterval = (tickSeconds / duration) * 100;
      seekBar.style.setProperty("--tick-interval", `${tickInterval}%`);
    }
    if (preserveProcessTimes) {
      if (processEndTime === undefined || processEndTime === null || processEndTime <= 0 || processEndTime > duration) {
        processEndTime = duration;
      }
      preserveProcessTimes = false;
    } else {
      processStartTime = 0;
      processEndTime = duration;
    }

    updateTimeDisplay(duration, "durationTime");
    positionControls();
    updateLoadButtonColor();
    toggleVideoPlaceholder(false);
    updateSliderTicks();
    updateVideoTimeSummary();

    player.playbackRate = playbackSpeed;
    speedSlider.value = playbackSpeed;
    DOM.speedValue.textContent = `${playbackSpeed.toFixed(1)}x`;
    toConsole("Playback speed restored", playbackSpeed, debuggin);

    player.volume = volumeLevel;
    player.muted = true;
    DOM.volumeOnIcon.classList.add("hidden");
    DOM.volumeOffIcon.classList.remove("hidden");
    volumeSlider.value = 0;
    DOM.volumeValue.textContent = "0";
    toConsole("Video muted on load", "Success", debuggin);
  });
  player.addEventListener("play", () => {
    DOM.playIcon.classList.add("hidden");
    DOM.pauseIcon.classList.remove("hidden");
  });
  player.addEventListener("pause", () => {
    DOM.playIcon.classList.remove("hidden");
    DOM.pauseIcon.classList.add("hidden");
  });
  player.addEventListener("error", () => {
    toConsole("Video load error", "Failed to load video from URL", debuggin);
    alert(
      "Failed to load the video from the provided URL. Please click the video placeholder to select the video file manually.",
    );
    player.src = "";
    player.removeAttribute("src");
    toggleVideoPlaceholder(true);
    updateLoadButtonColor();
  });

  addMarkerBtn = document.getElementById("addMarkerBtn");
  exportButton = document.getElementById("exportButton");

  projectExportButton = document.getElementById("projectExportButton");
  projectSaveAsButton = document.getElementById("projectSaveAsButton");
  projectImportButton = document.getElementById("projectImportButton");
  newProjectButton = document.getElementById("newProjectButton");
  loadVideoButton = document.getElementById("loadVideoButton");
  toggleFormatButton = document.getElementById("toggleFormatButton");
  speedSlider = document.getElementById("speedSlider");
  seekBar = document.getElementById("seekBar");
  playPauseButton = document.getElementById("playPauseButton");
  jumpToStartButton = document.getElementById("jumpToStartButton");
  rewind5sButton = document.getElementById("rewind5sButton");
  rewind1sButton = document.getElementById("rewind1sButton");
  forward1sButton = document.getElementById("forward1sButton");
  forward5sButton = document.getElementById("forward5sButton");
  muteButton = document.getElementById("muteButton");
  volumeSlider = document.getElementById("volumeSlider");

  loadLocalState();

  updateMarkersList();



  const urlParams = new URLSearchParams(window.location.search);
  const videoUrl = urlParams.get("v");
  if (videoUrl) {
    toConsole("Found video URL in GET parameter", videoUrl, debuggin);
    videoFileName = videoUrl.split("/").pop().split("?")[0] || videoUrl;
    player.src = videoUrl;
    player.load();
    saveLocalState();
  }

  addMarkerBtn.addEventListener("click", addMarker, false);
  exportButton.addEventListener("click", (e) => {
    exportToCSV();
  }, false);
  projectExportButton.addEventListener("click", () => exportToJSON(false), false);
  if (projectSaveAsButton) {
    projectSaveAsButton.addEventListener("click", () => exportToJSON(true), false);
  }

  projectImportButton.addEventListener("click", async () => {
    const isTauri = window.__TAURI__ !== undefined;
    if (isTauri) {
      try {
        const selected = await window.__TAURI__.dialog.open({
          multiple: false,
          filters: [{ name: "TMVideo Project", extensions: ["tmv"] }],
        });
        if (selected) {
          projectFilePath = typeof selected === "object" ? selected.path : selected;
          localStorage.setItem("projectFilePath", projectFilePath);
          const jsonText = await window.__TAURI__.fs.readTextFile(projectFilePath);
          importFromJSON(jsonText);
        }
      } catch (e) {
        toConsole("Error loading project via Tauri", e, debuggin);
        alert(`Tauri Error (Project Load): ${e.message || JSON.stringify(e)}`);
        showToast("Error loading project file.", "error");
      }
    } else {
      DOM.projectFileInput.click();
    }
  });

  newProjectButton.addEventListener("click", async () => {
    if (operations.length > 0 || player.getAttribute("src")) {
      const proceed = await asyncConfirm(
        "Are you sure you want to start a new project? All unsaved data will be lost.",
        "New Project",
      );
      if (!proceed) return;
    }

    player.pause();
    player.src = "";
    player.removeAttribute("src");
    player.load();

    operations = [];
    videoFileName = "";

    // Free memory by revoking old video blob URLs
    for (const key in videoBlobCache) {
      URL.revokeObjectURL(videoBlobCache[key]);
      delete videoBlobCache[key];
    }
    videoFilePath = "";
    projectFilePath = "";
    localStorage.removeItem("projectFilePath");
    projectName = "";
    projectComments = "";
    masterParts = [];
    masterLabour = [];
    processStartTime = 0;
    processEndTime = 0;

    videoQueue = [
      {
        videoId: 1,
        videoName: "Video 1",
        videoFileName: "",
        videoFilePath: "",
        processStartTime: 0,
        processEndTime: 0,
        appState: { operations: [] },
      },
    ];
    activeQueueIndex = 0;
    renderVideoQueueSelect();

    if (DOM.projectNameInput) DOM.projectNameInput.value = "";

    DOM.videoPlaceholder.textContent = "Load a video to get started";
    toggleVideoPlaceholder(true);
    updateLoadButtonColor();
    updateMarkersList();
    saveLocalState();
    updateSliderTicks();

    showToast("New project started.", "success");
  });
  loadVideoButton.addEventListener("click", async () => {
    const isTauri = window.__TAURI__ !== undefined;
    if (isTauri) {
      try {
        const selected = await window.__TAURI__.dialog.open({
          multiple: false,
          filters: [{ name: "Video", extensions: ["mp4", "webm", "ogg", "mov", "avi"] }],
        });
        if (selected) {
          await processNewVideoFile(selected, true);
        }
      } catch (e) {
        toConsole("Error opening video via Tauri", e, debuggin);
        alert(`Tauri Error (Video Load): ${e.message || JSON.stringify(e)}`);
      }
    } else {
      DOM.videoFileInput.click();
    }
  });

  DOM.videoPlaceholder.addEventListener("click", async () => {
    const isTauri = window.__TAURI__ !== undefined;
    if (isTauri) {
      try {
        const selected = await window.__TAURI__.dialog.open({
          multiple: false,
          filters: [{ name: "Video", extensions: ["mp4", "webm", "ogg", "mov", "avi"] }],
        });
        if (selected) {
          await processNewVideoFile(selected, true);
        }
      } catch (e) {
        toConsole("Error opening video via Tauri", e, debuggin);
        alert(`Tauri Error (Video Placeholder): ${e.message || JSON.stringify(e)}`);
      }
    } else {
      DOM.videoFileInput.click();
      toConsole("Video placeholder clicked", "Triggered Load Video", debuggin);
    }
  });

  toggleFormatButton.addEventListener("click", () => {
    if (durationMode === "hhmmssms") {
      durationMode = "ms";
    } else if (durationMode === "ms") {
      durationMode = "decimalMinutes";
    } else {
      durationMode = "hhmmssms";
    }
    toggleFormatButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> <span>Format (${
      durationMode === "hhmmssms" ? "HH:MM:SS.MS" : durationMode === "ms" ? "ms" : "min"
    })</span>`;
    updateMarkersList();
  });
  playPauseButton.addEventListener("click", () => {
    if (player.paused) {
      player.play();
    } else {
      player.pause();
    }
  });

  jumpToStartButton.addEventListener("click", () => {
    player.currentTime = processStartTime || 0;
    toConsole("Jumped to Start", player.currentTime, debuggin);
  });

  rewind5sButton.addEventListener("click", () => {
    player.currentTime = Math.max(processStartTime || 0, player.currentTime - 5);
    toConsole("Rewind 5s", player.currentTime, debuggin);
  });
  rewind1sButton.addEventListener("click", () => {
    player.currentTime = Math.max(processStartTime || 0, player.currentTime - 1);
    toConsole("Rewind 1s", player.currentTime, debuggin);
  });
  forward1sButton.addEventListener("click", () => {
    player.currentTime = Math.min(player.duration, player.currentTime + 1);
    toConsole("Forward 1s", player.currentTime, debuggin);
  });
  forward5sButton.addEventListener("click", () => {
    player.currentTime = Math.min(player.duration, player.currentTime + 5);
    toConsole("Forward 5s", player.currentTime, debuggin);
  });

  // Help Modal Logic
  const helpModal = document.getElementById("helpModal");
  const openHelpBtn = document.getElementById("openHelpBtn");
  const closeHelpBtn = document.getElementById("closeHelpBtn");
  const closeHelpBtnX = document.getElementById("closeHelpBtnX");

  if (openHelpBtn) openHelpBtn.addEventListener("click", () => helpModal.showModal());
  const closeModal = () => helpModal.close();
  if (closeHelpBtn) closeHelpBtn.addEventListener("click", closeModal);
  if (closeHelpBtnX) closeHelpBtnX.addEventListener("click", closeModal);

  muteButton.addEventListener("click", () => {
    player.muted = !player.muted;
    DOM.volumeOnIcon.classList.toggle("hidden", player.muted);
    DOM.volumeOffIcon.classList.toggle("hidden", !player.muted);
    toConsole("Mute toggled", player.muted, debuggin);
    if (!player.muted && volumeLevel === 0) {
      volumeLevel = 1;
      player.volume = 1;
      saveLocalState();
    }
    volumeSlider.value = player.muted ? 0 : volumeLevel;
    DOM.volumeValue.textContent = player.muted ? "0" : Math.round(volumeLevel * 100);
  });

  volumeSlider.addEventListener(
    "input",
    debounce((event) => {
      const volume = Number.parseFloat(event.target.value);
      if (!Number.isNaN(volume)) {
        player.volume = volume;
        volumeLevel = volume;
        player.muted = volume === 0;
        DOM.volumeOnIcon.classList.toggle("hidden", player.muted);
        DOM.volumeOffIcon.classList.toggle("hidden", !player.muted);
        DOM.volumeValue.textContent = Math.round(volume * 100);
        toConsole("Volume adjusted", volume, debuggin);
        saveLocalState();
      }
    }, 100),
  );

  if (speedSlider) {
    speedSlider.addEventListener(
      "input",
      debounce((event) => {
        const speed = Number.parseFloat(event.target.value);
        if (!Number.isNaN(speed)) {
          player.playbackRate = speed;
          playbackSpeed = speed;
          DOM.speedValue.textContent = `${speed.toFixed(1)}x`;
          toConsole("Speed slider input event fired", speed, debuggin);
          saveLocalState();
        }
      }, 100),
    );

    speedSlider.value = playbackSpeed;
    DOM.speedValue.textContent = `${playbackSpeed.toFixed(1)}x`;
  }

  if (seekBar) {
    seekBar.addEventListener(
      "input",
      debounce((event) => {
        let time = Number.parseFloat(event.target.value);
        if (!Number.isNaN(time)) {
          if (processStartTime > 0 && time < processStartTime) time = processStartTime;
          if (processEndTime > 0 && time > processEndTime) time = processEndTime;
          player.currentTime = time;
          toConsole("Seek bar input event fired", time, debuggin);
          toConsole("Video seeked to", time, debuggin);
        }
      }, 100),
    );
  }

  DOM.videoFileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) {
      toConsole("No video file selected", null, debuggin);
      return;
    }
    await processNewVideoFile(file, false);
    event.target.value = ""; // Reset input so the same file can be loaded again if needed
  });

  DOM.projectFileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        importFromJSON(e.target.result);
      };
      reader.readAsText(file);
    }
    event.target.value = ""; // Reset input so the same file can be loaded again if needed
  });

  DOM.zoomIn.addEventListener("click", () => {
    zoomLevel += 0.1;
    updateZoom();
  });
  DOM.zoomOut.addEventListener("click", () => {
    zoomLevel = Math.max(0.1, zoomLevel - 0.1);
    updateZoom();
  });
  DOM.resetZoom.addEventListener("click", () => {
    zoomLevel = 1;
    translateX = 0;
    translateY = 0;
    updateZoom();
  });
  if (DOM.takeSnapshotBtn) {
    DOM.takeSnapshotBtn.addEventListener("click", takeSnapshot);
  }
  if (DOM.toggleCinemaBtn) {
    DOM.toggleCinemaBtn.addEventListener("click", toggleCinemaMode);
  }

  marqueeOverlay.addEventListener("mousedown", startMarquee);
  marqueeOverlay.addEventListener("mousemove", drawMarquee);
  marqueeOverlay.addEventListener("mouseup", endMarquee);

  document.addEventListener("keydown", (e) => {
    // Disable shortcuts while Tetris is active to prevent key conflicts (e.g. arrows/spacebar seeking video)
    const tetrisCont = document.getElementById("tetrisContainer");
    if (tetrisCont && !tetrisCont.classList.contains("hidden") && tetrisCont.style.display !== "none") {
      return;
    }

    // Global shortcuts (can trigger anywhere)
    if (e.ctrlKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (e.shiftKey) {
        exportToJSON(true);
        toConsole("Shortcut triggered", "Save As", debuggin);
      } else {
        exportToJSON(false);
        toConsole("Shortcut triggered", "Save", debuggin);
      }
      return;
    }

    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;

    switch (e.key) {
      case "\\":
        e.preventDefault();
        toggleCinemaMode();
        break;
      case " ":
        e.preventDefault();
        if (!player.src) return;
        if (player.paused) {
          player.play();
        } else {
          player.pause();
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (!player.src) return;
        player.currentTime = Math.max(processStartTime || 0, player.currentTime - 1);
        toConsole("Rewind 1s (Left Arrow)", player.currentTime, debuggin);
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!player.src) return;
        player.currentTime = Math.max(processStartTime || 0, player.currentTime - 5);
        toConsole("Rewind 5s (Down Arrow)", player.currentTime, debuggin);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (!player.src) return;
        player.currentTime = Math.min(player.duration, player.currentTime + 1);
        toConsole("Forward 1s (Right Arrow)", player.currentTime, debuggin);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!player.src) return;
        player.currentTime = Math.min(player.duration, player.currentTime + 5);
        toConsole("Forward 5s (Up Arrow)", player.currentTime, debuggin);
        break;
      case "s":
      case "S":
        e.preventDefault();
        if (!player.src) return;
        takeSnapshot();
        break;
      case "Enter":
      case "m":
        e.preventDefault();
        if (!player.src) return;
        addMarker();
        break;
      case "l":
        e.preventDefault();
        if (loadVideoButton) loadVideoButton.click();
        break;
      case "=":
        e.preventDefault();
        zoomLevel += 0.1;
        updateZoom();
        break;
      case "-":
        e.preventDefault();
        zoomLevel = Math.max(0.1, zoomLevel - 0.1);
        updateZoom();
        break;
      case "Backspace":
        e.preventDefault();
        zoomLevel = 1;
        translateX = 0;
        translateY = 0;
        updateZoom();
        break;
      case "`":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8": {
        e.preventDefault();
        if (!player.src) return;
        const newSpeed = e.key === "`" ? 0.5 : Number.parseInt(e.key, 10);
        player.playbackRate = newSpeed;
        playbackSpeed = newSpeed;
        if (speedSlider) speedSlider.value = newSpeed;
        if (DOM.speedValue) DOM.speedValue.textContent = `${newSpeed.toFixed(1)}x`;
        toConsole("Playback speed shortcut", newSpeed, debuggin);
        saveLocalState();
        break;
      }
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (markers.length > 0 || player.src) {
      e.preventDefault();
      e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
      return e.returnValue;
    }
  });

  updateLoadButtonColor();
};

window.onload = () => {
  // Prevent horizontal scrolling/panning of the page in the Windows app
  document.documentElement.style.overflowX = "hidden";
  document.body.style.overflowX = "hidden";

  initializePlayer();
  toggleVideoPlaceholder(true);

  const isTauri = window.__TAURI__ !== undefined;
  if (isTauri) {
    window.__TAURI__.core
      .invoke("get_startup_file")
      .then(async (startupFile) => {
        if (startupFile) {
          try {
            projectFilePath = startupFile;
            localStorage.setItem("projectFilePath", projectFilePath);
            const jsonText = await window.__TAURI__.fs.readTextFile(startupFile);
            importFromJSON(jsonText);
            toConsole("Auto-loaded project from file association", startupFile, debuggin);
          } catch (e) {
            toConsole("Error auto-loading startup file", e, debuggin);
            showToast("Failed to auto-load project.", "error");
          }
        }
      })
      .catch((e) => toConsole("Failed to check startup file", e, debuggin));
  }
  initializeTrimFeature();
};

const startMarquee = (e) => {
  if (e.target.closest(".zoom-controls")) return;
  isDrawing = true;
  const rect = marqueeOverlay.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;
  marqueeRect.style.left = `${startX}px`;
  marqueeRect.style.top = `${startY}px`;
  marqueeRect.style.width = "0px";
  marqueeRect.style.height = "0px";
  marqueeRect.style.display = "block";
  toConsole("Marquee start", `(${startX}, ${startY})`, debuggin);
};

const drawMarquee = (e) => {
  if (!isDrawing) return;
  const rect = marqueeOverlay.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;

  const width = currentX - startX;
  const height = currentY - startY;

  if (width < 0) {
    marqueeRect.style.left = `${currentX}px`;
    marqueeRect.style.width = `${-width}px`;
  } else {
    marqueeRect.style.left = `${startX}px`;
    marqueeRect.style.width = `${width}px`;
  }

  if (height < 0) {
    marqueeRect.style.top = `${currentY}px`;
    marqueeRect.style.height = `${-height}px`;
  } else {
    marqueeRect.style.top = `${startY}px`;
    marqueeRect.style.height = `${height}px`;
  }
};

const endMarquee = (e) => {
  if (!isDrawing) return;
  isDrawing = false;
  marqueeRect.style.display = "none";

  const rect = marqueeOverlay.getBoundingClientRect();
  const endX = e.clientX - rect.left;
  const endY = e.clientY - rect.top;

  const x1 = Math.min(startX, endX);
  const x2 = Math.max(startX, endX);
  const y1 = Math.min(startY, endY);
  const y2 = Math.max(startY, endY);

  const marqueeWidth = x2 - x1;
  const marqueeHeight = y2 - y1;

  toConsole("Marquee end", `Box: (${x1}, ${y1}) to (${x2}, ${y2})`, debuggin);

  if (marqueeWidth < 10 || marqueeHeight < 10) {
    toConsole("Marquee too small, ignoring zoom", null, debuggin);
    return;
  }

  const videoWrapper = DOM.videoWrapper;
  const wrapperWidth = videoWrapper.clientWidth;
  const wrapperHeight = videoWrapper.clientHeight;

  const video = DOM.video;
  const videoRect = video.getBoundingClientRect();
  const wrapperRect = videoWrapper.getBoundingClientRect();
  const offsetX = videoRect.left - wrapperRect.left;
  const offsetY = videoRect.top - wrapperRect.top;
  const videoDisplayWidth = videoRect.width;
  const videoDisplayHeight = videoRect.height;
  toConsole(
    "Video display",
    `Width: ${videoDisplayWidth}, Height: ${videoDisplayHeight}, Offset: (${offsetX}, ${offsetY})`,
    debuggin,
  );

  const marqueeX1 = x1 - offsetX;
  const marqueeY1 = y1 - offsetY;
  const marqueeX2 = x2 - offsetX;
  const marqueeY2 = y2 - offsetY;

  const marqueeCenterX = (marqueeX1 + marqueeX2) / 2;
  const marqueeCenterY = (marqueeY1 + marqueeY2) / 2;
  toConsole("Marquee center (display)", `(${marqueeCenterX}, ${marqueeCenterY})`, debuggin);

  const zoomX = videoDisplayWidth / marqueeWidth;
  const zoomY = videoDisplayHeight / marqueeHeight;
  const newZoomLevel = Math.min(zoomX, zoomY);
  toConsole("New zoom level (relative)", newZoomLevel, debuggin);

  const previousZoomLevel = zoomLevel;
  zoomLevel *= newZoomLevel;
  toConsole("Cumulative zoom level", zoomLevel, debuggin);

  const videoCoordX = (marqueeCenterX - translateX * previousZoomLevel) / previousZoomLevel;
  const videoCoordY = (marqueeCenterY - translateY * previousZoomLevel) / previousZoomLevel;
  toConsole("Marquee center (video coords)", `(${videoCoordX}, ${videoCoordY})`, debuggin);

  const scaledVideoCoordX = videoCoordX * zoomLevel;
  const scaledVideoCoordY = videoCoordY * zoomLevel;
  toConsole("Scaled video coordinates", `(${scaledVideoCoordX}, ${scaledVideoCoordY})`, debuggin);

  translateX = (wrapperWidth / 2 - scaledVideoCoordX) / zoomLevel;
  translateY = (wrapperHeight / 2 - scaledVideoCoordY) / zoomLevel;
  toConsole("New translation", `(${translateX}, ${translateY})`, debuggin);

  const finalX = videoCoordX * zoomLevel + translateX * zoomLevel;
  const finalY = videoCoordY * zoomLevel + translateY * zoomLevel;
  toConsole("Final center position", `(${finalX}, ${finalY})`, debuggin);

  updateZoom();
};

const updateZoom = () => {
  const video = DOM.video;
  video.style.transform = `scale(${zoomLevel}) translate(${translateX}px, ${translateY}px)`;
  toConsole("Zoom updated", `Level: ${zoomLevel}, Translate: (${translateX}, ${translateY})`, debuggin);
};

const seektimeupdate = () => {
  if (player && playerReady) {
    const currentTime = player.currentTime;
    const duration = player.duration;
    if (seekBar) {
      seekBar.value = currentTime;
      seekBar.max = duration || 0;
    }
    updateTimeDisplay(currentTime, "currentTime");
    if (duration) {
      updateTimeDisplay(duration, "durationTime");
    }

    // Playhead Execution Logic: Jump & Loop
    if (markers && markers.length > 0) {
      const activeVideo = (typeof videoQueue !== "undefined" && videoQueue[activeQueueIndex]) || {};
      const endLimit = (activeVideo.virtualEndTime !== null && activeVideo.virtualEndTime !== undefined)
        ? activeVideo.virtualEndTime
        : (duration || player.duration || 0);

      for (let j = 0; j < markers.length; j += 1) {
        const currentMarker = markers[j];
        const nextMarker = markers[j + 1];
        const boundaryTime = nextMarker ? nextMarker.startTime : endLimit;

        if (currentMarker.type === "jump") {
          if (currentTime >= currentMarker.startTime && currentTime < boundaryTime) {
            player.currentTime = boundaryTime;
            return;
          }
        } else if (currentMarker.type === "loop") {
          const threshold = Math.max(0.5, player.playbackRate * 0.3);
          if (currentTime >= boundaryTime && currentTime - boundaryTime < threshold) {
            player.currentTime = currentMarker.startTime;
            return;
          }
        }
      }
    }

    // Constrain seek if we try to go before the processStartTime
    if (processStartTime > 0 && currentTime < processStartTime) {
      player.currentTime = processStartTime;
      return;
    }

    // Stop playback and constrain seek if we hit the processEndTime
    if (processEndTime > 0 && currentTime > processEndTime) {
      if (!player.paused) {
        player.pause();
      }
      player.currentTime = processEndTime;
      return;
    }
  }
};

const updateSliderTicks = () => {
  if (!player?.duration || !DOM.startTick || !DOM.endTick) return;

  if (processStartTime > 0) {
    const startPct = (processStartTime / player.duration) * 100;
    DOM.startTick.style.left = `calc(${startPct}% - 1px)`;
    DOM.startTick.classList.remove("hidden");
    if (DOM.startGreyOut) {
      DOM.startGreyOut.style.width = `${startPct}%`;
      DOM.startGreyOut.classList.remove("hidden");
    }
  } else {
    DOM.startTick.classList.add("hidden");
    if (DOM.startGreyOut) DOM.startGreyOut.classList.add("hidden");
  }

  if (processEndTime > 0 && processEndTime < player.duration) {
    const endPct = (processEndTime / player.duration) * 100;
    DOM.endTick.style.left = `calc(${endPct}% - 1px)`;
    DOM.endTick.classList.remove("hidden");
    if (DOM.endGreyOut) {
      DOM.endGreyOut.style.width = `${100 - endPct}%`;
      DOM.endGreyOut.classList.remove("hidden");
    }
  } else {
    DOM.endTick.classList.add("hidden");
    if (DOM.endGreyOut) DOM.endGreyOut.classList.add("hidden");
  }

  if (DOM.markerTicksContainer) {
    DOM.markerTicksContainer.innerHTML = "";
    markers.forEach((m) => {
      if (m.startTime >= 0 && m.startTime <= player.duration) {
        const pct = (m.startTime / player.duration) * 100;
        const tick = document.createElement("div");
        tick.className =
          "absolute h-3 w-0.5 bg-yellow-500 top-1/2 -translate-y-1/2 cursor-pointer transition-colors hover:bg-yellow-400";
        tick.style.pointerEvents = "auto";
        tick.style.left = `calc(${pct}% - 1px)`;
        tick.title = m.name; // Uses browser's native alt hover text
        tick.addEventListener("click", () => {
          player.currentTime = m.startTime;
        });
        DOM.markerTicksContainer.appendChild(tick);
      }
    });
  }
};

const updateTimeDisplay = (seconds, elementId) => {
  DOM[elementId].textContent = formatTimeToHHMMSSMS(seconds);
};

const positionControls = () => {
  const controlsBar = document.getElementById("video_controls_bar");
  if (controlsBar) {
    controlsBar.style.position = "relative";
    toConsole("Controls repositioned after video load", "Success", debuggin);
  }
};

const updateLoadButtonColor = () => {
  if (loadVideoButton && player && playPauseButton) {
    const src = player.getAttribute("src");
    if (!src) {
      loadVideoButton.classList.add("btn-icon-highlight");
      loadVideoButton.classList.remove("btn-icon");
      playPauseButton.disabled = true;
      jumpToStartButton.disabled = true;
      rewind5sButton.disabled = true;
      rewind1sButton.disabled = true;
      forward1sButton.disabled = true;
      forward5sButton.disabled = true;
      muteButton.disabled = true;
      volumeSlider.disabled = true;
    } else {
      loadVideoButton.classList.remove("btn-icon-highlight");
      loadVideoButton.classList.add("btn-icon");
      playPauseButton.disabled = false;
      jumpToStartButton.disabled = false;
      rewind5sButton.disabled = false;
      rewind1sButton.disabled = false;
      forward1sButton.disabled = false;
      forward5sButton.disabled = false;
      muteButton.disabled = false;
      volumeSlider.disabled = false;
    }
  }
};

const toggleVideoPlaceholder = (show) => {
  try {
    if (!DOM.videoPlaceholder || !DOM.videoWrapper) {
      throw new Error("Video placeholder or wrapper element not found");
    }
    if (show) {
      toConsole("Showing placeholder, hiding video wrapper", null, debuggin);
      DOM.videoPlaceholder.style.display = "flex";
      DOM.videoWrapper.style.display = "none";
    } else {
      toConsole("Hiding placeholder, showing video wrapper", null, debuggin);
      DOM.videoPlaceholder.style.display = "none";
      DOM.videoWrapper.style.display = "block";
    }
  } catch (error) {
    toConsole("toggleVideoPlaceholder error", error.message, debuggin);
    alert("Failed to toggle video placeholder. Please check the console for details.");
  }
};

const toggleSettings = (show) => {
  if (!DOM.settingsPanel || !DOM.settingsBackdrop) return;
  if (show) {
    DOM.settingsBackdrop.classList.remove("hidden");
    requestAnimationFrame(() => {
      DOM.settingsBackdrop.classList.remove("opacity-0");
      DOM.settingsPanel.classList.remove("translate-x-full");
    });
    if (DOM.projectCommentsInput) DOM.projectCommentsInput.value = projectComments || "";
  } else {
    DOM.settingsPanel.classList.add("translate-x-full");
    DOM.settingsBackdrop.classList.add("opacity-0");
    setTimeout(() => DOM.settingsBackdrop.classList.add("hidden"), 300);
  }
};

const addMarker = () => {
  if (!player.src) {
    alert("Please load a video first.");
    return;
  }

  const startTime = player.currentTime;
  toConsole("Marker start time", startTime, debuggin);

  if (startTime < processStartTime) {
    showToast("Marker starts before Process Start Time.", "error");
  } else if (processEndTime > 0 && startTime > processEndTime) {
    showToast("Marker starts after Process End Time.", "error");
  }

  const defaultName = `Marker ${markers.length + 1}`;

  markers.push({
    id: Date.now(),
    name: defaultName,
    startTime: startTime,
    type: "standard",
  });

  markers.sort((a, b) => a.startTime - b.startTime);

  saveLocalState();
  updateVideoTimeSummary();
  updateMarkersList();
};

const updateMarkerName = (markerIndex, newName) => {
  const trimmed = newName.trim();
  if (!trimmed) {
    alert("Marker name cannot be empty.");
    updateMarkersList();
    return;
  }
  const lowerName = trimmed.toLowerCase();
  if (lowerName === "terry" || lowerName === "tetris") {
    window.isSecretGame = true;
    const trimModal = document.getElementById("trimModal");
    if (trimModal) {
      if (typeof window.resetTrimModalUI === "function") {
        window.resetTrimModalUI();
      }
      trimModal.classList.remove("opacity-0", "scale-95");
      trimModal.classList.add("opacity-100", "scale-100");
      trimModal.showModal();
      if (typeof window.activateTetris === "function") {
        window.activateTetris();
      }
    }
    updateMarkersList();
    return;
  }
  markers[markerIndex].name = trimmed;
  saveLocalState();
};

const updateMarkerType = (markerIndex, newType) => {
  markers[markerIndex].type = newType;
  saveLocalState();
  updateVideoTimeSummary();
  updateMarkersList();
};

const deleteMarker = async (markerIndex) => {
  if (
    await asyncConfirm(
      `Are you sure you want to delete the marker "${markers[markerIndex].name}"? This action cannot be undone.`,
      "Delete Marker",
    )
  ) {
    markers.splice(markerIndex, 1);
    toConsole(`Deleted marker at index ${markerIndex}`, `Total markers left: ${markers.length}`, debuggin);
    saveLocalState();
    updateMarkersList();
  }
};

const jumpToMarkerTime = (markerIndexOrTime, type) => {
  if (!player.src) {
    alert("Please load a video first.");
    return;
  }
  let time;
  if (type === undefined) {
    time = Number.parseFloat(markerIndexOrTime);
  } else {
    const marker = markers[markerIndexOrTime];
    if (!marker) return;
    time = type === "start" ? marker.startTime : marker.endTime;
  }
  if (time !== undefined && time !== null) {
    player.currentTime = time;
    player.pause();
    toConsole("Jumped to marker time", time, debuggin);
  }
};

const playFromMarkerTime = (markerIndexOrTime, type) => {
  if (!player.src) {
    alert("Please load a video first.");
    return;
  }
  let time;
  if (type === undefined) {
    time = Number.parseFloat(markerIndexOrTime);
  } else {
    const marker = markers[markerIndexOrTime];
    if (!marker) return;
    time = type === "start" ? marker.startTime : marker.endTime;
  }
  if (time !== undefined && time !== null) {
    player.currentTime = time;
    player.play();
    toConsole("Playing from marker time", time, debuggin);
  }
};

const syncMarkerToPlayhead = (markerIndex) => {
  if (!player.src) {
    alert("Please load a video first.");
    return;
  }
  const time = player.currentTime;
  markers[markerIndex].startTime = time;
  markers.sort((a, b) => a.startTime - b.startTime);
  saveLocalState();
  updateMarkersList();
};

// Video Trimming & Compression Feature
const initializeTrimFeature = () => {
  const isTauri = window.__TAURI__ !== undefined;
  if (!isTauri) return;

  const trimVideoBtn = document.getElementById("trimVideoBtn");
  const trimModal = document.getElementById("trimModal");
  const closeTrimBtnX = document.getElementById("closeTrimBtnX");
  const cancelTrimBtn = document.getElementById("cancelTrimBtn");
  const trimOnlyBtn = document.getElementById("trimOnlyBtn");
  const trimCompressBtn = document.getElementById("trimCompressBtn");

  if (trimVideoBtn) {
    trimVideoBtn.classList.remove("hidden");
    trimVideoBtn.addEventListener("click", () => {
      if (!player?.src) {
        alert("Please load a video first.");
        return;
      }
      document.getElementById("trimStartInput").value = formatTimeToHHMMSSMS(processStartTime);
      document.getElementById("trimEndInput").value = formatTimeToHHMMSSMS(processEndTime || player.duration);
      resetTrimModalUI();
      trimModal.classList.remove("opacity-0", "scale-95");
      trimModal.classList.add("opacity-100", "scale-100");
      trimModal.showModal();
    });
  }

  const resetTrimModalUI = () => {
    trimOnlyBtn.disabled = false;
    trimCompressBtn.disabled = false;
    cancelTrimBtn.disabled = false;
    cancelTrimBtn.className = "btn btn-outline-secondary";
    cancelTrimBtn.textContent = "Cancel";
    document.getElementById("trimProgressContainer").classList.add("hidden");
    const spinner = document.getElementById("trimProgressSpinner");
    if (spinner) spinner.classList.add("hidden");

    if (typeof window.cleanupTetris === "function") {
      window.cleanupTetris();
    }
    const tetrisCont = document.getElementById("tetrisContainer");
    if (tetrisCont) {
      tetrisCont.style.display = "none";
      tetrisCont.classList.add("hidden");
    }
    const normalContent = document.getElementById("trimNormalContent");
    if (normalContent) normalContent.classList.remove("hidden");
    const normalFooter = document.getElementById("trimNormalFooter");
    if (normalFooter) normalFooter.classList.remove("hidden");
  };
  window.resetTrimModalUI = resetTrimModalUI;

  const handleCancelClick = async () => {
    if (activeFFmpegChild) {
      isAborted = true;
      toConsole("User clicked cancel: Aborting FFmpeg process...", null, debuggin);
      try {
        await activeFFmpegChild.kill();
        showToast("Processing aborted by user.", "warning");
      } catch (e) {
        toConsole("Error killing FFmpeg process", e, debuggin);
      }
      activeFFmpegChild = null;
    }
    trimModal.classList.remove("opacity-100", "scale-100");
    trimModal.classList.add("opacity-0", "scale-95");
    await new Promise((r) => setTimeout(r, 300));
    trimModal.close();
    resetTrimModalUI();
  };

  const closeTrim = () => {
    const tetrisCont = document.getElementById("tetrisContainer");
    if (window.isSecretGame) {
      window.isSecretGame = false;
      handleCancelClick();
    } else if (tetrisCont && !tetrisCont.classList.contains("hidden") && tetrisCont.style.display !== "none") {
      toConsole("X clicked in Tetris mode, returning to progress screen", null, debuggin);
      if (typeof window.showNormalProgressScreen === "function") {
        window.showNormalProgressScreen();
      }
    } else {
      handleCancelClick();
    }
  };

  if (closeTrimBtnX) closeTrimBtnX.addEventListener("click", closeTrim);
  if (cancelTrimBtn) cancelTrimBtn.addEventListener("click", closeTrim);

  const handleTrimAction = async (isCompression) => {
    toConsole("Trim action button clicked", { isCompression }, debuggin);
    const startVal = parseTimeFromHHMMSSMS(document.getElementById("trimStartInput").value);
    const endVal = parseTimeFromHHMMSSMS(document.getElementById("trimEndInput").value);

    if (startVal === null || endVal === null) {
      toConsole("Trim validation failed: Invalid time format", { startVal, endVal }, debuggin);
      alert("Invalid start or end time format.");
      return;
    }
    if (startVal >= endVal) {
      toConsole("Trim validation failed: Start >= End", { startVal, endVal }, debuggin);
      alert("Start time must be less than end time.");
      return;
    }

    const qualityMode = document.querySelector('input[name="trimQuality"]:checked').value;
    toConsole("Trim parameters validation success", { startVal, endVal, qualityMode }, debuggin);
    
    trimOnlyBtn.disabled = true;
    trimCompressBtn.disabled = true;
    
    // Style Cancel button as red Abort button
    cancelTrimBtn.disabled = false;
    cancelTrimBtn.className = "btn btn-danger";
    cancelTrimBtn.textContent = "Abort Trim";

    try {
      await processVideo(startVal, endVal, qualityMode, isCompression);
    } catch (err) {
      toConsole("Error processing video", err, debuggin);
      
      // Quietly handle user cancellation
      if (err.message === "Save location was not specified.") {
        trimOnlyBtn.disabled = false;
        trimCompressBtn.disabled = false;
        cancelTrimBtn.disabled = false;
        return;
      }
      
      // Quietly handle user abort
      if (err.message === "Aborted by user") {
        resetTrimModalUI();
        return;
      }
      
      // Handle same path selection
      if (err.message === "Input and output paths are identical.") {
        trimOnlyBtn.disabled = false;
        trimCompressBtn.disabled = false;
        cancelTrimBtn.disabled = false;
        alert("Error: The output file path cannot be the same as the input video path. Please choose a different name or location.");
        return;
      }

      trimModal.classList.remove("opacity-100", "scale-100");
      trimModal.classList.add("opacity-0", "scale-95");
      setTimeout(() => {
        trimModal.close();
        resetTrimModalUI();
      }, 300);
      alert(`Video processing failed: ${err.message || err}`);
    }
  };

  if (trimOnlyBtn) trimOnlyBtn.addEventListener("click", () => handleTrimAction(false));
  if (trimCompressBtn) trimCompressBtn.addEventListener("click", () => handleTrimAction(true));
};

const processVideo = async (start, end, qualityMode, isCompression) => {
  isAborted = false;
  if (!videoFilePath) {
    toConsole("processVideo abort: No active video file path found", null, debuggin);
    alert("No active video file path found.");
    return;
  }

  const defaultPath = `trimmed_${videoFileName || "video.mp4"}`;
  toConsole("Opening Tauri save dialog...", { defaultPath }, debuggin);
  
  let outputPath;
  try {
    outputPath = await window.__TAURI__.dialog.save({
      filters: [{ name: "Video", extensions: ["mp4", "webm", "mov", "avi"] }],
      defaultPath: defaultPath,
    });
  } catch (err) {
    toConsole("Tauri save dialog error", err, debuggin);
    throw err;
  }

  if (!outputPath) {
    toConsole("Tauri save dialog cancelled by user", null, debuggin);
    throw new Error("Save location was not specified.");
  }

  const actualOutputPath = typeof outputPath === "object" ? outputPath.path : outputPath;
  toConsole("Save path selected", actualOutputPath, debuggin);

  if (videoFilePath && actualOutputPath && videoFilePath.toLowerCase() === actualOutputPath.toLowerCase()) {
    toConsole("processVideo abort: Input and output paths are identical", actualOutputPath, debuggin);
    throw new Error("Input and output paths are identical.");
  }

  // Build FFmpeg args.
  //
  // Key insight: The Tauri plugin-shell Rust backend reads stderr via BufReader::lines()
  // which only yields data events on \n. FFmpeg's human-readable stats use \r (no \n)
  // so they NEVER trigger data events — they accumulate in Tokio's buffer silently.
  //
  // Fix: -nostats suppresses the \r-only stats entirely.
  //       -progress pipe:2 writes \n-terminated key=value progress to stderr fd 2.
  //       These lines ARE delivered by BufReader::lines() as reliable data events.
  //
  // -ss AFTER -i performs sequential seeking, which is 100% reliable and avoids
  //   startup hangs on files with broken index structures.
  // -t specifies duration, which is more robust and standard than -to when seeking.
  const args = [
    "-y",
    "-nostdin",
    "-nostats",
    "-i", videoFilePath,
    "-ss", start.toString(),
    "-t", (end - start).toString(),
    "-progress", "pipe:2"
  ];

  if (!isCompression) {
    args.push("-c", "copy");
  } else {
    const inputHeight = player.videoHeight || 0;
    let targetHeight = 1080;
    if (qualityMode === "low") {
      targetHeight = 720;
    }
    // Avoid upscaling: if input height is smaller, use it
    if (inputHeight > 0 && inputHeight < targetHeight) {
      targetHeight = inputHeight;
    }

    // Limit CPU threads to 4 to prevent thread/CPU starvation of the Tauri host IPC.
    // Use -max_muxing_queue_size 4096 and -c:a copy to prevent audio/video muxing deadlocks.
    if (qualityMode === "low") {
      args.push(
        "-vf", `scale=-2:${targetHeight}`,
        "-c:v", "libx264",
        "-crf", "32",
        "-preset", "veryfast",
        "-threads", "4"
      );
    } else if (qualityMode === "high") {
      args.push(
        "-vf", `scale=-2:${targetHeight}`,
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "medium",
        "-threads", "4"
      );
    } else {
      args.push(
        "-vf", `scale=-2:${targetHeight}`,
        "-c:v", "libx264",
        "-crf", "26",
        "-preset", "fast",
        "-threads", "4"
      );
    }
    args.push("-c:a", "copy", "-max_muxing_queue_size", "4096");
  }

  args.push(actualOutputPath);
  toConsole("Spawning FFmpeg with args", args, debuggin);

  const trimModal = document.getElementById("trimModal");
  const progressContainer = document.getElementById("trimProgressContainer");
  const progressBar = document.getElementById("trimProgressBar");
  const progressText = document.getElementById("trimProgressText");
  const spinner = document.getElementById("trimProgressSpinner");

  progressContainer.classList.remove("hidden");
  if (spinner) spinner.classList.remove("hidden");
  progressBar.style.width = "0%";
  progressText.textContent = "0%";

  const duration = end - start;
  const stderrLogs = [];
  let lastPct = -1;

  let watchdogTimer = null;
  const WATCHDOG_MS = 30_000;
  const resetWatchdog = () => {
    clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(async () => {
      toConsole("FFmpeg watchdog: no progress for 30s — aborting", null, debuggin);
      isAborted = true;
      try {
        await window.__TAURI__.core.invoke("abort_ffmpeg");
        toConsole("FFmpeg watchdog kill: success", null, debuggin);
      } catch (killErr) {
        toConsole("FFmpeg watchdog kill: failed", killErr, debuggin);
      }
    }, WATCHDOG_MS);
  };

  // Start watchdog immediately
  resetWatchdog();

  // Create activeFFmpegChild wrapper compatibility layer
  activeFFmpegChild = {
    kill: async () => {
      try {
        await window.__TAURI__.core.invoke("abort_ffmpeg");
      } catch (e) {
        toConsole("Error aborting ffmpeg via invoke", e, debuggin);
      }
    },
  };

  let unlistenStderr = null;
  try {
    // Listen for progress events emitted from the Rust backend
    unlistenStderr = await window.__TAURI__.event.listen("ffmpeg-stderr", (event) => {
      const line = event.payload || "";
      // Filter out progress key=value spam from console logging to prevent IPC backpressure/deadlock.
      const isProgressSpam =
        line.includes("=") &&
        (line.startsWith("frame=") ||
          line.startsWith("fps=") ||
          line.startsWith("stream_") ||
          line.startsWith("bitrate=") ||
          line.startsWith("total_size=") ||
          line.startsWith("out_time") ||
          line.startsWith("dup_frames=") ||
          line.startsWith("drop_frames=") ||
          line.startsWith("speed=") ||
          line.startsWith("progress="));
      if (!isProgressSpam) {
        toConsole("FFmpeg stderr raw output", line, debuggin);
      }

      stderrLogs.push(line);
      if (stderrLogs.length > 50) {
        stderrLogs.shift();
      }

      // Match out_time_us (standard FFmpeg microsecond progress) anywhere in the chunk.
      const match = line.match(/out_time_us=(\d+)/);
      if (match) {
        resetWatchdog(); // reset 30s timer on every progress tick
        const val = Number.parseInt(match[1], 10);
        const currentSeconds = val / 1_000_000;
        if (duration > 0) {
          const pct = Math.min(100, Math.max(0, Math.round((currentSeconds / duration) * 100)));
          if (pct !== lastPct) {
            lastPct = pct;
            toConsole("FFmpeg progress percentage updated", { pct, currentSeconds, duration }, debuggin);
            progressBar.style.width = `${pct}%`;
            progressText.textContent = `${pct}%`;
            if (typeof window.updateTetrisProgress === "function") {
              window.updateTetrisProgress(pct);
            }
          }
        }
      }
    });

    toConsole("Spawning FFmpeg sidecar process via Rust backend...", null, debuggin);
    await window.__TAURI__.core.invoke("run_ffmpeg", { args });

    // Ensure progress shows 100% on success
    progressBar.style.width = "100%";
    progressText.textContent = "100%";

    // Hide spinner immediately so it stops spinning
    if (spinner) spinner.classList.add("hidden");

    for (let i = 0; i < markers.length; i += 1) {
      markers[i].startTime = markers[i].startTime - start;
      if (markers[i].endTime) {
        markers[i].endTime = markers[i].endTime - start;
      }
    }

    processStartTime = 0;
    processEndTime = end - start;

    videoFilePath = actualOutputPath;
    videoFileName = actualOutputPath.replace(/^.*[\\\/]/, "");

    const tauriAssetUrl = window.__TAURI__.core.convertFileSrc(videoFilePath);
    player.src = tauriAssetUrl;
    player.preload = "auto";
    player.load();
    toggleVideoPlaceholder(false);

    saveLocalState();
    updateMarkersList();

    const tetrisCont = document.getElementById("tetrisContainer");
    if (
      typeof window.onVideoProcessingFinished === "function" &&
      tetrisCont &&
      !tetrisCont.classList.contains("hidden")
    ) {
      // In Tetris mode, we can show the toast immediately since the game is visible, 
      // but wait, it might still be behind the backdrop if the dialog top layer is active.
      // We will show it anyway.
      showToast("Video completed.", "success");
      window.onVideoProcessingFinished();
    } else {
      // Close the modal first
      trimModal.classList.remove("opacity-100", "scale-100");
      trimModal.classList.add("opacity-0", "scale-95");
      await new Promise((r) => setTimeout(r, 300));
      trimModal.close();
      if (typeof window.resetTrimModalUI === "function") {
        window.resetTrimModalUI();
      }

      // Show toast after the modal is closed and backdrop is gone
      showToast("Video completed.", "success");

      // Show confirm prompt after modal is completely gone
      const saveConfirm = await asyncConfirm("Timestamps shifted. Save project changes now?", "Save Project");
      if (saveConfirm) {
        await exportToJSON(false);
      }
    }
  } catch (err) {
    toConsole("FFmpeg process failed or aborted", err, debuggin);
    if (isAborted) {
      throw new Error("Aborted by user");
    }
    const fullErrLogs = stderrLogs.join("\n");
    throw new Error(
      `${err.message || err}\n\nFFmpeg Logs:\n${fullErrLogs || "(no stderr output)"}`
    );
  } finally {
    clearTimeout(watchdogTimer);
    activeFFmpegChild = null;
    if (unlistenStderr) {
      unlistenStderr();
    }
  }
};
