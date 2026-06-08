/**
 * @markdown
 * # AI CONTEXT MAP
 *
 * ## GLOBAL STATE STRUCTURE
 * - `videoQueue`: Array of objects representing the loaded videos. Each object contains metadata and state like `videoId`, `videoName`, `videoFileName`, `videoFilePath`, `processStartTime`, `processEndTime`, and `appState` (which holds `markers`).
 * - `activeQueueIndex`: Integer representing the currently selected video slot in `videoQueue`.
 * - `markers`: Array of current active video markers (syncs back to `videoQueue[activeQueueIndex].appState.markers`).
 *
 * ## PERSISTENCE & LIFECYCLE
 * - `saveLocalState()`: Synchronizes memory (active globals like `videoFileName`, `processStartTime`, `markers`) back to the current `videoQueue` slot, and serializes the complete application state payload to `localStorage`.
 * - `loadLocalState()`: Rehydrates memory from `localStorage` on application mount, resolving `videoQueue` references to initialize the player.
 *
 * ## LEFT SIDEBAR ARCHITECTURE (Playlist UI)
 * - The new layout shifts away from modal drag-and-drop to a unified persistent side panel (`#playlist-queue-sidebar`).
 * - Render loops (`renderSidebarPlaylist`) rebuild the visual DOM nodes entirely based on `videoQueue` data.
 * - Interaction logic toggles active indices by swapping elements directly in the array (`videoQueue[index] = videoQueue[index+1]`) and forcing a re-render.
 */

// 1. Global State Configuration & Element Cache Registries
const appWindow =
	window.__TAURI__?.window?.appWindow ||
	window.__TAURI__?.window?.getCurrentWindow?.() ||
	null;
const Command =
	window.__TAURI__?.shell?.Command ||
	window.__TAURI__?.pluginShell?.Command ||
	null;
const writeTextFile = window.__TAURI__?.fs?.writeTextFile || null;
const remove = window.__TAURI__?.fs?.remove || null;
const exists = window.__TAURI__?.fs?.exists || null;
const tempdir = window.__TAURI__?.os?.tempdir || null;
const join = window.__TAURI__?.path?.join || null;
const openDialog = window.__TAURI__?.dialog?.open || null;
let isCinemaMode = false;
let cinemaIdleTimer = null;
let player;
let loadVideoButton;
let addMarkerBtn;
let projectExportButton;
let projectSaveAsButton;
let projectImportButton;
let newProjectButton;
let packageBtn;
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
window.currentWaveformDataPath = null;
window.peaksInstance = null;
const selectionStart = { x: 0, y: 0 };
const selectionEnd = { x: 0, y: 0 };

// 2. Early Lifecycle Hooks (DOMContentLoaded, window.onload, and Tauri Launch Argument Handlers)
/** Single-line descriptor for onload. */
window.onload = () => {
	// Prevent horizontal scrolling/panning of the page in the Windows app
	document.documentElement.style.overflowX = "hidden";
	document.body.style.overflowX = "hidden";

	if (!playerReady) {
		initializePlayer();
	}

	if (!player?.src) {
		toggleVideoPlaceholder(true);
	}

	initializeTrimFeature();
};

document.addEventListener("DOMContentLoaded", () => {
	if (!playerReady) {
		initializePlayer();
	}

	const expandBtn = document.getElementById("expandToEditorBtn");
	if (expandBtn) {
		expandBtn.addEventListener("click", disableMiniPlayerMode);
	}

	const timelineToggleBtn = document.getElementById("timeline-toggle-btn");
	if (timelineToggleBtn) {
		timelineToggleBtn.addEventListener("click", () => {
			const mainGrid = document.getElementById("mainLayoutGrid");
			if (mainGrid) {
				mainGrid.classList.toggle("timeline-expanded");
			}
		});
	}
});

// Helpers for project data clearance and video loading
window.clearAllPreviousProjectData = () => {
	window.resetClosedCaptions();
	if (player) {
		player.pause();
		player.src = "";
		player.removeAttribute("src");
		try {
			player.load();
		} catch (e) {}
	}

	markers = [];
	videoFileName = "";
	preserveProcessTimes = false;

	for (const key in videoBlobCache) {
		URL.revokeObjectURL(videoBlobCache[key]);
		delete videoBlobCache[key];
	}
	videoFilePath = "";
	projectFilePath = "";
	localStorage.removeItem("projectFilePath");
	localStorage.removeItem("timeStudyData");
	localStorage.removeItem("tmvideo_markers");
	localStorage.removeItem("tmvideo_project_metadata");
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
			appState: { markers: [] },
		},
	];
	activeQueueIndex = 0;

	if (DOM.projectNameInput) DOM.projectNameInput.value = "";

	if (DOM.videoPlaceholder) {
		DOM.videoPlaceholder.textContent = "Load a video to get started";
	}
	toggleVideoPlaceholder(true);
	if (typeof updateLoadButtonColor === "function") updateLoadButtonColor();
	if (typeof updateMarkersList === "function") updateMarkersList();
	saveLocalState();
	if (typeof updateSliderTicks === "function") updateSliderTicks();
};

window.loadVideo = async (filePath) => {
	try {
		const extractedFileName = filePath.split(/[/\\]/).pop();
		videoFileName = extractedFileName;
		videoFilePath = filePath;

		if (!videoQueue || videoQueue.length === 0) {
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
		}
		activeQueueIndex = 0;

		videoQueue[0].videoFileName = videoFileName;
		videoQueue[0].videoFilePath = videoFilePath;
		videoQueue[0].videoName = videoFileName;

		if (window.__TAURI__) {
			const tauriAssetUrl = window.__TAURI__.core.convertFileSrc(videoFilePath);
			player.src = tauriAssetUrl;
		} else {
			player.src = videoFilePath;
		}
		player.preload = "auto";
		player.load();
		toggleVideoPlaceholder(false);
		if (typeof window.loadSubtitleTrack === "function") {
			window.loadSubtitleTrack(videoFilePath);
		}

		if (typeof renderVideoQueueSelect === "function") renderVideoQueueSelect();
		if (typeof updateLoadButtonColor === "function") updateLoadButtonColor();
		if (typeof updateMarkersList === "function") updateMarkersList();
		saveLocalState();
		if (typeof updateSliderTicks === "function") updateSliderTicks();

		if (typeof enableMiniPlayerMode === "function") {
			await enableMiniPlayerMode();
		}

		toConsole("Auto-loaded video from launch argument", filePath, debuggin);
		showToast("Video loaded.", "success");
	} catch (e) {
		toConsole("Error auto-loading video file", e, debuggin);
		showToast("Failed to load video file.", "error");
	}
};

window.initializeLaunchArgumentHandler = async () => {
	try {
		if (window.__TAURI__) {
			const launchPath = await window.__TAURI__.core.invoke(
				"get_launch_argument",
			);

			if (launchPath && launchPath.trim() !== "") {
				console.log("[Launch System] External OS file detected:", launchPath);
				const lower = launchPath.toLowerCase();

				if (lower.endsWith(".tmv") || lower.endsWith(".tmvz")) {
					try {
						projectFilePath = launchPath;
						localStorage.setItem("projectFilePath", projectFilePath);
						const jsonText = await window.__TAURI__.fs.readTextFile(launchPath);
						importFromJSON(jsonText);
						toConsole(
							"Auto-loaded project from launch argument",
							launchPath,
							debuggin,
						);
					} catch (e) {
						toConsole("Error auto-loading project file", e, debuggin);
						showToast("Failed to auto-load project.", "error");
					}
				} else {
					// 1. CLEAR STALE LOCAL STORAGE PERSISTENCE GHOSTS
					localStorage.removeItem("tmvideo_markers");
					localStorage.removeItem("tmvideo_project_metadata");
					if (typeof window.clearAllPreviousProjectData === "function") {
						window.clearAllPreviousProjectData();
					} else if (typeof markers !== "undefined") {
						markers = [];
						if (typeof renderMarkersTable === "function") renderMarkersTable();
					}

					// 2. RESIZE THE VIEWPORT CONTAINER DYNAMICALLY TO PREVENT SCROLLBARS
					if (window.__TAURI__.window?.getCurrentWindow) {
						const appWindow = window.__TAURI__.window.getCurrentWindow();
						const currentSize = await appWindow.innerSize();
						const targetHeight = currentSize.height + 44;

						if (window.__TAURI__.window.LogicalSize) {
							const factor = await appWindow.scaleFactor();
							const logicalWidth = currentSize.width / factor;
							const logicalHeight = targetHeight / factor;
							await appWindow.setSize(
								new window.__TAURI__.window.LogicalSize(
									logicalWidth,
									logicalHeight,
								),
							);
						} else {
							await appWindow.setSize({
								type: "Physical",
								width: currentSize.width,
								height: targetHeight,
							});
						}
						console.log(
							"[Launch System] Viewport height expanded by 44px to accommodate full playback panel metrics.",
						);
					}

					// 3. LOAD THE TARGET INGESTED MEDIA FILE
					if (typeof window.loadVideo === "function") {
						window.loadVideo(launchPath);
					}
				}
			} else {
				if (
					(videoQueue &&
						videoQueue.length > 0 &&
						videoQueue[0].videoFilePath) ||
					player.src
				) {
					return;
				}
				if (typeof window.clearAllPreviousProjectData === "function") {
					window.clearAllPreviousProjectData();
				}
			}
		}
	} catch (error) {
		console.error(
			"[Launch System] Error initializing file launch constraints:",
			error,
		);
	}
};

if (window.__TAURI__ !== undefined) {
	document.addEventListener("DOMContentLoaded", () => {
		window.initializeLaunchArgumentHandler();
	});
}

// 3. Media Initialization & Streaming Event Subsystems
/** Resets closed captions and destroys peaks instance. */
window.resetClosedCaptions = () => {
	window.currentCaptions = [];
	window.captionsVisible = true;

	if (window.peaksInstance) {
		try {
			window.peaksInstance.destroy();
		} catch (e) {
			console.error("Error destroying peaksInstance:", e);
		}
		window.peaksInstance = null;
	}
	window.currentWaveformDataPath = null;
	const peaksContainer = document.getElementById("peaks-timeline-wrapper");
	if (peaksContainer) {
		peaksContainer.style.display = "none";
	}
	const seekBarContainer = document.getElementById("seekBarContainer");
	if (seekBarContainer) {
		seekBarContainer.style.display = "block";
	}

	const ccToggleBtn = document.getElementById("ccToggleBtn");
	if (ccToggleBtn) {
		ccToggleBtn.setAttribute("disabled", "true");
		ccToggleBtn.classList.remove("text-yellow-500", "dark:text-yellow-400");
		ccToggleBtn.classList.add("text-zinc-400", "dark:text-zinc-600");
	}

	if (window.captionInterval) {
		clearInterval(window.captionInterval);
		window.captionInterval = null;
	}
	if (window.subInterval) {
		clearInterval(window.subInterval);
		window.subInterval = null;
	}

	// Recent Memory Purge
	localStorage.removeItem("captions");
	localStorage.removeItem("subtitles");
	localStorage.removeItem("transcript");
	localStorage.removeItem("whisper_results");
	sessionStorage.removeItem("captions");
	sessionStorage.removeItem("subtitles");

	if (window.indexedDB) {
		const dbsToPurge = [
			"TMVideoDB",
			"TranscriptDB",
			"WhisperDB",
			"captions",
			"subtitles",
		];
		for (const dbName of dbsToPurge) {
			try {
				const deleteRequest = window.indexedDB.deleteDatabase(dbName);
				deleteRequest.onsuccess = () =>
					console.log("Successfully purged offline database:", dbName);
			} catch (e) {
				console.warn("Database purge skipped for:", dbName, e);
			}
		}
	}

	for (let i = localStorage.length - 1; i >= 0; i--) {
		const key = localStorage.key(i);
		if (
			key &&
			(key.toLowerCase().includes("caption") ||
				key.toLowerCase().includes("sub") ||
				key.toLowerCase().includes("transcript") ||
				key.toLowerCase().includes("cue"))
		) {
			localStorage.removeItem(key);
		}
	}

	for (let i = sessionStorage.length - 1; i >= 0; i--) {
		const key = sessionStorage.key(i);
		if (
			key &&
			(key.toLowerCase().includes("caption") ||
				key.toLowerCase().includes("sub") ||
				key.toLowerCase().includes("transcript") ||
				key.toLowerCase().includes("cue"))
		) {
			sessionStorage.removeItem(key);
		}
	}

	const videoPlayer = document.querySelector("video") || player;
	if (videoPlayer) {
		videoPlayer.pause();
		const existingTracks = videoPlayer.querySelectorAll("track");
		existingTracks.forEach((track) => {
			track.remove();
		});

		while (videoPlayer.textTracks.length > 0) {
			videoPlayer.textTracks[0].mode = "disabled";
		}
		videoPlayer.src = "";
		try {
			videoPlayer.load(); // Forces the browser to flush the active buffer completely
		} catch (e) {
			// Ignore load error on empty src
		}
	}

	const ccDisplay = document.getElementById("cc-output");
	if (ccDisplay) {
		ccDisplay.innerHTML = "";
	}

	const transcriptContainer = document.getElementById("transcript-list");
	if (transcriptContainer) {
		transcriptContainer.innerHTML = "";
	}
};

/** Loads a subtitle track for the provided video path. */
window.loadSubtitleTrack = async (filePath) => {
	let ccTrack = document.getElementById("ccTrack");
	if (!ccTrack) {
		ccTrack = document.createElement("track");
		ccTrack.id = "ccTrack";
		ccTrack.kind = "captions";
		ccTrack.srclang = "en";
		ccTrack.label = "English";
		ccTrack.default = true;
		if (player) {
			player.appendChild(ccTrack);
		}
	}
	ccTrack.src = "";

	const isTauri = window.__TAURI__ !== undefined;
	if (!isTauri || !filePath) return;
	try {
		const vttPath = await window.__TAURI__.core.invoke("resolve_subtitles", {
			videoPath: filePath,
		});
		if (vttPath) {
			ccTrack.src = window.__TAURI__.core.convertFileSrc(vttPath);
			toConsole("Loaded subtitle track", vttPath, debuggin);
			const ccToggleBtn = document.getElementById("ccToggleBtn");
			if (ccToggleBtn) {
				ccToggleBtn.removeAttribute("disabled");
				ccToggleBtn.classList.remove("text-zinc-400", "dark:text-zinc-600");
				ccToggleBtn.classList.add("text-yellow-500", "dark:text-yellow-400");
			}
		} else {
			const genBtn =
				document.getElementById("generateBtn") ||
				document.getElementById("generateAutoCaptionsBtn");
			if (genBtn) {
				genBtn.classList.remove("hidden");
			}
		}
	} catch (err) {
		toConsole("Error resolving subtitles", err, debuggin);
	}
};

/** Generates and loads the waveform timeline and thumbnails. */
window.loadWaveformTimeline = async () => {
	const isTauri = window.__TAURI__ !== undefined;
	if (!isTauri || !videoFilePath) return;

	const wrapper = document.getElementById("peaks-timeline-wrapper");
	const seekBarContainer = document.getElementById("seekBarContainer");

	if (document.body.classList.contains("mini-player")) {
		if (wrapper) wrapper.style.display = "none";
		if (seekBarContainer) seekBarContainer.style.display = "block";
		return;
	}

	if (seekBarContainer) {
		seekBarContainer.style.display = "block";
	}
	if (wrapper) {
		wrapper.style.display = "block";
	}

	try {
		const videoEl = document.querySelector("video") || player;
		const duration = videoEl.duration || player.duration || 0;
		const peakArray = await window.__TAURI__.core.invoke("get_waveform_data", {
			videoPath: videoFilePath,
			durationSeconds: duration,
		});
		if (!peakArray || peakArray.length === 0) {
			console.warn("Waveform data empty, bypassing timeline initialization.");
			window.currentWaveformData = [];
			return;
		}

		// Save the raw peak data sequence directly to the global window memory state
		window.currentWaveformData = peakArray;
		window.currentWaveformDataPath = videoFilePath;

		// Trigger ruler, video, and audio track rendering
		window.paintTimelineRuler(duration);
		window.setupVideoTrack();
		window.drawCustomAudioWaveform();
		if (typeof window.paintTimelineMarkersAndShading === "function") {
			window.paintTimelineMarkersAndShading();
		}

		// Trigger filmstrip thumbnail extraction
		const videoTrack = document.getElementById("timeline-video-track");
		if (videoTrack) {
			videoTrack.innerHTML = "Developing Video Filmstrip Tracks...";
			window.setupVideoTrack();
		}

		const totalTrackWidth = videoTrack?.offsetWidth || 1200;
		const requiredTileCount = Math.ceil(totalTrackWidth / 120);

		window.__TAURI__.core
			.invoke("generate_timeline_thumbnails", {
				videoPath: videoFilePath,
				tileCount: requiredTileCount,
			})
			.then((thumbnailPaths) => {
				if (videoTrack) {
					videoTrack.innerHTML = "";
					videoTrack.style.justifyContent = "flex-start";
					videoTrack.style.overflowX = "auto";
					for (const pathString of thumbnailPaths) {
						const imgElement = document.createElement("img");
						imgElement.src = window.__TAURI__.core.convertFileSrc(pathString);
						imgElement.className =
							"h-full w-[120px] object-cover flex-shrink-0 border-r border-zinc-200 dark:border-zinc-700 pointer-events-none";
						videoTrack.appendChild(imgElement);
					}
					window.setupVideoTrack();
				}
			})
			.catch((err) => {
				console.error("Error generating filmstrip thumbnails:", err);
				if (videoTrack) {
					videoTrack.innerHTML = "Failed to load filmstrip.";
					window.setupVideoTrack();
				}
			});
	} catch (err) {
		console.error("Error generating waveform data:", err);
		window.currentWaveformData = [];
	}
};

/** Joins and compresses the selected video segments. */
window.joinAndCompressVideos = async (videoSegments) => {
	const proceed = await asyncConfirm(
		"Joining these videos will clear all active timeline markers upon success. Do you want to proceed?",
		"Confirm Join & Compress",
	);
	if (!proceed) return;

	const isTauri = window.__TAURI__ !== undefined;
	if (!isTauri) {
		alert("Tauri desktop API is required.");
		return;
	}

	if (!videoSegments || videoSegments.length < 1) {
		alert("Please select at least one video to join.");
		return;
	}

	const outputFileName = await asyncPrompt(
		"Enter output file name (e.g. final_video.mp4):",
		"final_video.mp4",
		"Output File",
	);
	if (!outputFileName) return;

	const joinBtn = document.getElementById("joinAndCompressBtn");
	const originalText = joinBtn
		? joinBtn.textContent
		: "Join & Compress Selected";
	if (joinBtn) {
		joinBtn.disabled = true;
		joinBtn.textContent = "Processing...";
	}

	showToast("Joining and compressing videos... This may take a while.", "info");

	try {
		const finalPath = await window.__TAURI__.core.invoke(
			"join_and_compress_videos",
			{
				videoSegments: videoSegments.map((s) => ({
					path: s.path,
					start_time: s.start_time,
					end_time: s.end_time,
					loop_count: s.loopCount || s.loop_count || 1,
					loopCount: s.loopCount || s.loop_count || 1,
				})),
				outputFileName: outputFileName,
			},
		);

		// On Success (State Reset)
		markers = [];
		if (DOM.markerTicksContainer) DOM.markerTicksContainer.innerHTML = "";

		if (typeof updateMarkersList === "function") updateMarkersList();
		if (typeof updateSliderTicks === "function") updateSliderTicks();
		saveLocalState();

		showToast(
			"Success! Final video generated. Active markers have been reset.",
			"success",
		);
	} catch (err) {
		toConsole("Join & Compress failed", err, debuggin);
		alert(`Join and Compress failed: ${err.message || err}`);
	} finally {
		if (joinBtn) {
			joinBtn.disabled = false;
			joinBtn.textContent = originalText;
		}
	}
};

/** Processes and loads a new video file into the active project slot. */
const processNewVideoFile = async (fileOrPath, isTauriPath = false) => {
	if (typeof window.resetVideoViewport === "function") {
		window.resetVideoViewport(player);
	}
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

	const isRelinking =
		!hasExistingVideo && (markers.length > 0 || projectName !== "");

	window.resetClosedCaptions();

	if (isTauriPath) {
		const filePath =
			typeof fileOrPath === "object" ? fileOrPath.path : fileOrPath;
		videoFileName =
			typeof fileOrPath === "object" && fileOrPath.name
				? fileOrPath.name
				: filePath.split(/[/\\]/).pop();
		videoFilePath = filePath;
		saveLocalState();

		const tauriAssetUrl = window.__TAURI__.core.convertFileSrc(videoFilePath);
		player.src = tauriAssetUrl;
		player.preload = "auto";
		window.loadSubtitleTrack(videoFilePath);
	} else {
		const file = fileOrPath;
		videoFileName = file.name;
		videoFilePath = file.path || ""; // Tauri injects the absolute path here
		saveLocalState();

		const isTauri = window.__TAURI__ !== undefined;
		if (isTauri && videoFilePath) {
			const tauriAssetUrl = window.__TAURI__.core.convertFileSrc(videoFilePath);
			player.src = tauriAssetUrl;
			player.preload = "auto";
			window.loadSubtitleTrack(videoFilePath);
		} else {
			const fileURL = URL.createObjectURL(file);
			videoBlobCache[videoFileName] = fileURL;
			player.src = fileURL;
			player.preload = "metadata";
			const ccTrack = document.getElementById("ccTrack");
			if (ccTrack) ccTrack.src = "";
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
	renderVideoQueueSelect();
	updateSliderTicks();

	updateLoadButtonColor();
};

/** Captures a snapshot of the current video frame. */
const takeSnapshot = () => {
	if (!player?.src) {
		showToast("No video loaded.", "error");
		return;
	}
	const video = player;
	const container = document.getElementById("video-wrapper-id");
	if (!container) {
		showToast("Error taking snapshot.", "error");
		return;
	}

	const containerWidth = container.offsetWidth;
	const containerHeight = container.offsetHeight;

	const videoRatio = video.videoWidth / video.videoHeight;
	const containerRatio = containerWidth / containerHeight;

	let baseWidth;
	let baseHeight;

	if (videoRatio > containerRatio) {
		baseWidth = containerWidth;
		baseHeight = containerWidth / videoRatio;
	} else {
		baseHeight = containerHeight;
		baseWidth = containerHeight * videoRatio;
	}

	const baseLeft = (containerWidth - baseWidth) / 2;
	const baseTop = (containerHeight - baseHeight) / 2;

	const currentZoom = window.zoomLevel || 1.0;
	const currentX = window.translateX || 0;
	const currentY = window.translateY || 0;

	const layoutX1 = -currentX / currentZoom;
	const layoutY1 = -currentY / currentZoom;
	const layoutX2 = (containerWidth - currentX) / currentZoom;
	const layoutY2 = (containerHeight - currentY) / currentZoom;

	const videoX1 = layoutX1 - baseLeft;
	const videoY1 = layoutY1 - baseTop;
	const videoX2 = layoutX2 - baseLeft;
	const videoY2 = layoutY2 - baseTop;

	let sx = videoX1 * (video.videoWidth / baseWidth);
	let sy = videoY1 * (video.videoHeight / baseHeight);
	let sw = (videoX2 - videoX1) * (video.videoWidth / baseWidth);
	let sh = (videoY2 - videoY1) * (video.videoHeight / baseHeight);

	sx = Math.max(0, sx);
	sy = Math.max(0, sy);
	if (sw > video.videoWidth - sx) {
		sw = video.videoWidth - sx;
	}
	if (sh > video.videoHeight - sy) {
		sh = video.videoHeight - sy;
	}

	const canvas = document.createElement("canvas");
	canvas.width = sw;
	canvas.height = sh;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

	try {
		const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
		const link = document.createElement("a");
		const currentTimeStr = player.currentTime.toFixed(2).replace(".", "_");
		link.download = `snapshot_${currentTimeStr}.jpg`;
		link.href = dataUrl;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		showToast("Snapshot saved in Downloads", "success");
		window.triggerPlaybackOverlay("Snapshot Captured");
	} catch (error) {
		toConsole("Failed to take snapshot", error, debuggin);
		showToast("Error taking snapshot.", "error");
	}
};

/** Toggles cinema mode layout and fullscreen state. */
// 1. Establish global tracker state variable if not already defined
if (typeof window.currentViewMode === "undefined") {
	window.currentViewMode = "normal"; // Choices: 'normal', 'cinema', 'miniplayer'
}

window.cycleViewMode = (targetMode) => {
	const mainGrid = document.getElementById("mainLayoutGrid");
	const modeBtn =
		document.getElementById("expand-player-btn") ||
		document.getElementById("toggleCinemaBtn") ||
		document.getElementById("toggleMiniPlayerBtn") ||
		document.querySelector(".view-mode-button");

	if (!mainGrid) {
		console.error("[View System] Main layout grid target frame not found.");
		return;
	}

	// 2. Rotate to the next chronological layout state
	if (targetMode) {
		window.currentViewMode = targetMode;
	} else {
		switch (window.currentViewMode) {
			case "normal":
				window.currentViewMode = "cinema";
				break;
			case "cinema":
				window.currentViewMode = "miniplayer";
				break;
			default:
				window.currentViewMode = "normal";
				break;
		}
	}

	console.log(
		`[View System] Shifting layout mode configuration to: ${window.currentViewMode.toUpperCase()}`,
	);

	// 3. Apply target class updates to the master viewport wrapper
	// Remove all state variables first to keep state transitions completely clean
	mainGrid.classList.remove(
		"cinema-mode",
		"miniplayer-mode",
		"cinema-active",
		"mini-player",
	);
	document.body.classList.remove(
		"cinema-mode",
		"miniplayer-mode",
		"cinema-active",
		"mini-player",
	);

	// Sync local tracking state variable
	isCinemaMode = window.currentViewMode === "cinema";

	const mainContentArea = mainGrid.parentElement;
	const controlBar = document.getElementById("mediaControlsContainer");
	const wrapper = document.getElementById("peaks-timeline-wrapper");
	const seekBarContainer = document.getElementById("seekBarContainer");
	const expandBtn = document.getElementById("expandToEditorBtn");

	// Clean up timers & reset control bar transformations
	if (cinemaIdleTimer) {
		clearTimeout(cinemaIdleTimer);
		cinemaIdleTimer = null;
	}
	if (controlBar) {
		controlBar.classList.remove("translate-y-full", "opacity-0");
	}
	document.body.classList.remove("hide-controls");

	if (window.currentViewMode === "cinema") {
		mainGrid.classList.add("cinema-mode", "cinema-active");
		document.body.classList.add("cinema-mode", "cinema-active");
		if (modeBtn) modeBtn.title = "Switch to Miniplayer View";
		if (expandBtn) expandBtn.classList.add("hidden");

		if (mainContentArea) {
			mainContentArea.style.overflowY = "hidden";
		}

		// Handle Monitor Fullscreen
		if (appWindow) {
			appWindow.setFullscreen(true).catch((e) => console.error(e));
		} else if (document.documentElement.requestFullscreen) {
			document.documentElement
				.requestFullscreen()
				.catch((e) => console.warn(e));
		}

		// Reset inactivity timer
		resetCinemaIdleTimer();

		// Handle peaks timeline display
		if (wrapper) wrapper.style.display = "none";

		showToast("Cinema Mode Activated", "info");
	} else if (window.currentViewMode === "miniplayer") {
		mainGrid.classList.add("miniplayer-mode", "mini-player");
		document.body.classList.add("miniplayer-mode", "mini-player");
		if (modeBtn) modeBtn.title = "Switch to Normal View";
		if (expandBtn) expandBtn.classList.remove("hidden");

		if (mainContentArea) {
			mainContentArea.style.overflowY = "auto";
		}

		// Exit Fullscreen
		if (appWindow) {
			appWindow.setFullscreen(false).catch((e) => console.error(e));
		} else if (document.exitFullscreen && document.fullscreenElement) {
			document.exitFullscreen().catch((e) => console.warn(e));
		}

		// Resize window to mini player dimensions
		if (appWindow) {
			appWindow
				.unmaximize()
				.then(() => {
					const size = new window.__TAURI__.window.LogicalSize(800, 600);
					return appWindow.setSize(size);
				})
				.then(() => {
					return appWindow.center();
				})
				.catch((e) => console.error("Error enabling mini player mode", e));
		}

		if (wrapper) wrapper.style.display = "none";
		if (seekBarContainer) seekBarContainer.style.display = "block";

		showToast("Miniplayer Mode Activated", "info");
	} else {
		// Normal state defaults
		if (modeBtn) modeBtn.title = "Switch to Cinema Mode";
		if (expandBtn) expandBtn.classList.add("hidden");

		if (mainContentArea) {
			mainContentArea.style.overflowY = "auto";
		}

		// Exit Fullscreen
		if (appWindow) {
			appWindow.setFullscreen(false).catch((e) => console.error(e));
		} else if (document.exitFullscreen && document.fullscreenElement) {
			document.exitFullscreen().catch((e) => console.warn(e));
		}

		// Maximize window
		if (appWindow) {
			appWindow.maximize().catch((e) => console.error(e));
		}

		if (wrapper) wrapper.style.display = "block";
		if (seekBarContainer) seekBarContainer.style.display = "block";
		window.loadWaveformTimeline();

		showToast("Standard Layout Restored", "info");
	}

	// Trigger a video canvas alignment calculation adjust if needed
	if (typeof window.repositionControls === "function") {
		setTimeout(window.repositionControls, 50);
	}
};

// Compatibility wrappers for existing references
const enableMiniPlayerMode = async () => {
	window.cycleViewMode("miniplayer");
};
const disableMiniPlayerMode = async () => {
	window.cycleViewMode("normal");
};
const toggleCinemaMode = async () => {
	window.cycleViewMode(
		window.currentViewMode === "cinema" ? "normal" : "cinema",
	);
};
// Centralized overlay presentation management engine
window.triggerPlaybackOverlay = (messageText) => {
	const overlayContainer =
		document.getElementById("video-action-overlay") ||
		document.querySelector(".action-overlay-toast");
	if (!overlayContainer) return;

	// Set the text content dynamically
	overlayContainer.innerText = messageText;

	// Make it instantly visible by removing any hidden or opacity-0 classes
	overlayContainer.classList.remove(
		"hidden",
		"opacity-0",
		"pointer-events-none",
	);
	overlayContainer.classList.add("flex", "opacity-100");

	// Clear any pre-existing fading timer to prevent race conditions during rapid tapping
	if (window.overlayFadeTimeout) {
		clearTimeout(window.overlayFadeTimeout);
	}

	// Schedule automatic self-destruct concealment after exactly 5000ms (5 seconds)
	window.overlayFadeTimeout = setTimeout(() => {
		console.log(
			"[Overlay System] Automatically fading transient action message indicator...",
		);
		overlayContainer.classList.add("opacity-0", "pointer-events-none");

		// Cleanly switch back to display none once the CSS opacity transition finishes painting
		setTimeout(() => {
			overlayContainer.classList.remove("flex");
			overlayContainer.classList.add("hidden");
		}, 300); // Matches standard tailwind/CSS transition-opacity duration metrics
	}, 5000);
};

/** Resets the inactivity timer for hiding controls in cinema mode. */
function resetCinemaIdleTimer() {
	if (!isCinemaMode) return; // Only run in Cinema Mode

	const controlBar = document.getElementById("mediaControlsContainer");
	if (!controlBar) return;

	// 1. Mouse moved: Show the controls instantly
	controlBar.classList.remove("translate-y-full", "opacity-0");
	document.body.classList.remove("hide-controls");

	// 2. Clear the existing timer
	if (cinemaIdleTimer) clearTimeout(cinemaIdleTimer);

	// 3. Set a new 5-second timer to hide the controls
	cinemaIdleTimer = setTimeout(() => {
		controlBar.classList.add("translate-y-full", "opacity-0");
		document.body.classList.add("hide-controls");
	}, 5000);
}

/** Initializes the primary video player events, controls, and UI state. */
const initializePlayer = () => {
	player = DOM.video;
	player.preservesPitch = true;
	playerReady = true;
	toConsole("Video element initialized", "Success", debuggin);
	toConsole("App Version", APP_VERSION, debuggin);

	marqueeOverlay = DOM.marqueeOverlay;
	marqueeRect = DOM.marqueeRect;

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
		DOM.addVideoQueueBtn.addEventListener("click", addNewVideoToQueue);
	}
	if (DOM.editVideoQueueBtn) {
		DOM.editVideoQueueBtn.addEventListener("click", editVideoInQueue);
	}
	const reorderBtn = document.getElementById("reorder-videos-btn");
	if (reorderBtn) {
		reorderBtn.addEventListener("click", () => {
			const mainGrid = document.getElementById("mainLayoutGrid");
			if (mainGrid) {
				const isOpen = mainGrid.classList.toggle("playlist-sidebar-open");
				if (isOpen && typeof window.renderSidebarPlaylist === "function") {
					window.renderSidebarPlaylist();
				}
			}
		});
	}

	const closeSidebarBtn = document.getElementById("close-playlist-sidebar-btn");
	if (closeSidebarBtn) {
		closeSidebarBtn.addEventListener("click", () => {
			const mainGrid = document.getElementById("mainLayoutGrid");
			if (mainGrid) {
				mainGrid.classList.remove("playlist-sidebar-open");
			}
		});
	}

	const toggleMiniPlayerBtn = document.getElementById("toggleMiniPlayerBtn");
	if (toggleMiniPlayerBtn) {
		toggleMiniPlayerBtn.addEventListener("click", (e) => {
			e.preventDefault();
			window.cycleViewMode();
		});
	}

	const ccToggleBtn = document.getElementById("ccToggleBtn");
	if (ccToggleBtn) {
		ccToggleBtn.addEventListener("click", window.toggleClosedCaptions);
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
			if (DOM.projectCommentsInput)
				projectComments = DOM.projectCommentsInput.value;
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
		if (DOM.closeMasterDataBtnX)
			DOM.closeMasterDataBtnX.addEventListener("click", closeMasterModal);
		if (DOM.closeMasterDataBtn)
			DOM.closeMasterDataBtn.addEventListener("click", closeMasterModal);
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
			if (
				processEndTime === undefined ||
				processEndTime === null ||
				processEndTime <= 0 ||
				processEndTime > duration
			) {
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

		if (videoFilePath) {
			if (document.body.classList.contains("mini-player")) {
				const wrapper = document.getElementById("peaks-timeline-wrapper");
				if (wrapper) wrapper.style.display = "none";
				const seekBarContainer = document.getElementById("seekBarContainer");
				if (seekBarContainer) seekBarContainer.style.display = "block";
			} else {
				window.loadWaveformTimeline();
			}
		}
		if (typeof window.initializeVideoViewportZoomPan === "function") {
			window.initializeVideoViewportZoomPan(
				player,
				document.getElementById("video-wrapper-id"),
			);
		}
	});
	player.addEventListener("play", () => {
		DOM.playIcon.classList.add("hidden");
		DOM.pauseIcon.classList.remove("hidden");
		window.lastCheckedVideoTime = player.currentTime;
		if (!window.playheadAnimationId) {
			window.playheadAnimationId = requestAnimationFrame(
				window.syncTimelinePlayheadSmoothly,
			);
		}
	});
	player.addEventListener("playing", () => {
		window.lastCheckedVideoTime = player.currentTime;
		if (!window.playheadAnimationId) {
			window.playheadAnimationId = requestAnimationFrame(
				window.syncTimelinePlayheadSmoothly,
			);
		}
	});
	player.addEventListener("pause", () => {
		DOM.playIcon.classList.remove("hidden");
		DOM.pauseIcon.classList.add("hidden");
		if (window.playheadAnimationId) {
			cancelAnimationFrame(window.playheadAnimationId);
			window.playheadAnimationId = null;
		}
	});
	player.addEventListener("ended", (event) => {
		seektimeupdate();

		let isCurrentlyLooping = false;
		if (window.markerLoopRegistry) {
			isCurrentlyLooping = Object.values(window.markerLoopRegistry).some(
				(state) => state.isSeeking,
			);
		}
		if (
			window.activeLoopId !== null &&
			!String(window.activeLoopId).startsWith("exhausted_")
		) {
			isCurrentlyLooping = true;
		}

		if (isCurrentlyLooping) {
			if (event) event.preventDefault();
			return;
		}

		if (window.playheadAnimationId) {
			cancelAnimationFrame(window.playheadAnimationId);
			window.playheadAnimationId = null;
		}
	});
	player.addEventListener("seeking", () => {
		window.lastCheckedVideoTime = player.currentTime;
		if (window.playheadAnimationId) {
			cancelAnimationFrame(window.playheadAnimationId);
			window.playheadAnimationId = null;
		}
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
	packageBtn = document.getElementById("packageBtn");
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

	if (videoQueue && videoQueue.length > 0) {
		const currentVideo = videoQueue[activeQueueIndex];
		if (currentVideo?.videoFilePath) {
			const isTauri = window.__TAURI__ !== undefined;
			if (isTauri && window.__TAURI__.core?.convertFileSrc) {
				const assetUrl = window.__TAURI__.core.convertFileSrc(
					currentVideo.videoFilePath,
				);
				player.src = assetUrl;
				player.preload = "auto";
				player.load();
				toggleVideoPlaceholder(false);
				if (typeof window.loadSubtitleTrack === "function") {
					window.loadSubtitleTrack(currentVideo.videoFilePath);
				}
			}
		}
	}

	updateMarkersList();

	// Wire up Save / Save As / Package buttons
	projectExportButton?.addEventListener("click", () => exportToJSON(false));
	projectSaveAsButton?.addEventListener("click", () => exportToJSON(true));
	packageBtn?.addEventListener("click", async () => {
		const isTauri = window.__TAURI__ !== undefined;
		if (!isTauri) {
			showToast("Packaging requires the desktop app.", "error");
			return;
		}

		// --- helpers to drive the progress modal ---
		const modal = document.getElementById("packageProgressModal");
		const pkgTitle = document.getElementById("pkgModalTitle");
		const pkgStatus = document.getElementById("pkgStatusMessage");
		const pkgBar = document.getElementById("pkgProgressBar");
		const pkgPct = document.getElementById("pkgPercent");
		const pkgCounter = document.getElementById("pkgFileCounter");
		const pkgSpinner = document.getElementById("pkgSpinner");
		const pkgDoneIcon = document.getElementById("pkgDoneIcon");
		const pkgDoneFooter = document.getElementById("pkgDoneFooter");
		const pkgCloseBtn = document.getElementById("pkgCloseBtn");

		const resetModal = () => {
			pkgTitle.textContent = "Packaging Project…";
			pkgStatus.textContent = "Preparing…";
			pkgBar.style.width = "0%";
			pkgPct.textContent = "0%";
			pkgCounter.textContent = "";
			pkgSpinner.classList.remove("hidden");
			pkgDoneIcon.classList.add("hidden");
			pkgDoneFooter.classList.add("hidden");
		};

		const updateModal = ({ step, percent, message, current, total }) => {
			pkgBar.style.width = `${percent}%`;
			pkgPct.textContent = `${percent}%`;
			pkgStatus.textContent = message;
			if (total > 0 && (step === "video" || step === "extract")) {
				pkgCounter.textContent = `File ${current} of ${total}`;
			}
			if (step === "done") {
				pkgTitle.textContent = "Package Complete";
				pkgSpinner.classList.add("hidden");
				pkgDoneIcon.classList.remove("hidden");
				pkgDoneFooter.classList.remove("hidden");
				pkgBar.classList.replace("bg-blue-600", "bg-green-500");
			}
		};

		try {
			// Sync state to localStorage first
			saveLocalState();
			const projectJson = localStorage.getItem("timeStudyData") || "{}";
			const videoPaths = (videoQueue || [])
				.map((v) => v.videoFilePath || "")
				.filter((p) => p.length > 0);

			const defaultName = projectName
				? `${sanitizeFilename(projectName)}.tmvz`
				: "project.tmvz";
			const filePath = await window.__TAURI__.dialog.save({
				filters: [{ name: "TMVideo Package", extensions: ["tmvz"] }],
				defaultPath: defaultName,
			});
			if (!filePath) return;

			const actualPath =
				typeof filePath === "object" ? filePath.path : filePath;

			// Open modal and subscribe to progress events
			resetModal();
			modal.showModal();

			let unlisten = null;
			unlisten = await window.__TAURI__.event.listen(
				"package-progress",
				(event) => {
					updateModal(event.payload);
					if (event.payload.step === "done") {
						// Unlisten after a tick so the final update renders first
						setTimeout(() => {
							if (unlisten) {
								unlisten();
								unlisten = null;
							}
						}, 200);
					}
				},
			);

			// Wire the close button
			const onClose = () => {
				modal.close();
				pkgBar.classList.replace("bg-green-500", "bg-blue-600");
			};
			pkgCloseBtn?.addEventListener("click", onClose, { once: true });

			try {
				await window.__TAURI__.core.invoke("save_tspz_bundle", {
					projectJson,
					videoPaths,
					outputPath: actualPath,
				});
			} catch (invokeErr) {
				// Clean up listener and modal on Rust-side error
				if (unlisten) {
					unlisten();
					unlisten = null;
				}
				modal.close();
				pkgBar.classList.replace("bg-green-500", "bg-blue-600");
				throw invokeErr;
			}
		} catch (e) {
			toConsole("Error packaging project", e, debuggin);
			showToast(`Error packaging project: ${e?.message || e}`, "error");
		}
	});

	const urlParams = new URLSearchParams(window.location.search);
	const videoUrl = urlParams.get("v");
	if (videoUrl) {
		toConsole("Found video URL in GET parameter", videoUrl, debuggin);
		window.resetClosedCaptions();
		videoFileName = videoUrl.split("/").pop().split("?")[0] || videoUrl;
		player.src = videoUrl;
		player.load();
		saveLocalState();
	}

	addMarkerBtn?.addEventListener("click", addMarker, false);

	projectImportButton?.addEventListener("click", async () => {
		const isTauri = window.__TAURI__ !== undefined;
		if (isTauri) {
			try {
				const selected = await window.__TAURI__.dialog.open({
					multiple: false,
					filters: [
						{ name: "TMVideo Project / Package", extensions: ["tmv", "tmvz"] },
					],
				});
				if (!selected) return;

				const selectedPath =
					typeof selected === "object" ? selected.path : selected;
				const lower = selectedPath.toLowerCase();

				if (lower.endsWith(".tmvz")) {
					// --- Bundle load path ---
					toConsole("Loading .tmvz bundle", selectedPath, debuggin);
					showToast("Extracting bundle…", "info");

					try {
						const result = await window.__TAURI__.core.invoke(
							"load_tspz_bundle",
							{
								bundlePath: selectedPath,
							},
						);

						// Populate project from the extracted JSON
						importFromJSON(result.project_json);

						// Re-link each video using the extracted temp paths
						if (result.video_paths && result.video_paths.length > 0) {
							result.video_paths.forEach((tempPath, i) => {
								if (videoQueue[i]) {
									videoQueue[i].videoFilePath = tempPath;
									videoQueue[i].videoFileName = tempPath.replace(
										/^.*[\\/]/,
										"",
									);
								}
							});
							// Reload the active video with the temp path
							const active = videoQueue[activeQueueIndex];
							if (active?.videoFilePath) {
								const url = window.__TAURI__.core.convertFileSrc(
									active.videoFilePath,
								);
								player.src = url;
								player.preload = "auto";
								player.load();
								toggleVideoPlaceholder(false);
								window.loadSubtitleTrack(active.videoFilePath);
							}
							saveLocalState();
							renderVideoQueueSelect();
						}

						showToast("Bundle loaded successfully.", "success");
					} catch (bundleErr) {
						toConsole("Error loading .tmvz bundle", bundleErr, debuggin);
						showToast(
							`Error loading bundle: ${bundleErr?.message || bundleErr}`,
							"error",
						);
					}
				} else {
					// --- Standard .tmv load path ---
					projectFilePath = selectedPath;
					localStorage.setItem("projectFilePath", projectFilePath);
					const jsonText =
						await window.__TAURI__.fs.readTextFile(projectFilePath);
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

	newProjectButton?.addEventListener("click", async () => {
		if (markers.length > 0 || player.getAttribute("src")) {
			const proceed = await asyncConfirm(
				"Are you sure you want to start a new project? All unsaved data will be lost.",
				"New Project",
			);
			if (!proceed) return;
		}

		window.resetClosedCaptions();
		player.pause();
		player.src = "";
		player.removeAttribute("src");
		player.load();

		markers = [];
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
				appState: { markers: [] },
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
	loadVideoButton?.addEventListener("click", async () => {
		const isTauri = window.__TAURI__ !== undefined;
		if (isTauri) {
			try {
				const selected = await window.__TAURI__.dialog.open({
					multiple: false,
					filters: [
						{ name: "Video", extensions: ["mp4", "webm", "ogg", "mov", "avi"] },
					],
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
					filters: [
						{ name: "Video", extensions: ["mp4", "webm", "ogg", "mov", "avi"] },
					],
				});
				if (selected) {
					await processNewVideoFile(selected, true);
				}
			} catch (e) {
				toConsole("Error opening video via Tauri", e, debuggin);
				alert(
					`Tauri Error (Video Placeholder): ${e.message || JSON.stringify(e)}`,
				);
			}
		} else {
			DOM.videoFileInput.click();
			toConsole("Video placeholder clicked", "Triggered Load Video", debuggin);
		}
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
		player.currentTime = Math.max(
			processStartTime || 0,
			player.currentTime - 5,
		);
		toConsole("Rewind 5s", player.currentTime, debuggin);
	});
	rewind1sButton.addEventListener("click", () => {
		player.currentTime = Math.max(
			processStartTime || 0,
			player.currentTime - 1,
		);
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

	if (openHelpBtn)
		openHelpBtn.addEventListener("click", () => helpModal.showModal());
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
		DOM.volumeValue.textContent = player.muted
			? "0"
			: Math.round(volumeLevel * 100);
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
		seekBar.addEventListener("input", (event) => {
			let time = Number.parseFloat(event.target.value);
			if (!Number.isNaN(time)) {
				if (processStartTime > 0 && time < processStartTime)
					time = processStartTime;
				if (processEndTime > 0 && time > processEndTime) time = processEndTime;
				player.currentTime = time;
				const duration = player.duration || 1;
				const pct = (time / duration) * 100;
				const playheads = document.querySelectorAll(".sequencer-playhead");
				for (const ph of playheads) {
					ph.style.left = `${pct}%`;
				}
			}
		});
		seekBar.addEventListener("mouseup", (e) => e.target.blur());
		seekBar.addEventListener("touchend", (e) => e.target.blur());
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
		const container = document.getElementById("video-wrapper-id");
		const centerX = container.offsetWidth / 2;
		const centerY = container.offsetHeight / 2;

		const oldZoom = window.zoomLevel || 1.0;
		const oldX = window.translateX || 0;
		const oldY = window.translateY || 0;

		let targetZoom = oldZoom + 0.1;
		targetZoom = Math.min(15.0, Math.max(1.0, targetZoom));

		const scaleRatio = targetZoom / oldZoom;

		window.zoomLevel = targetZoom;
		window.translateX = centerX - (centerX - oldX) * scaleRatio;
		window.translateY = centerY - (centerY - oldY) * scaleRatio;

		const videoElement = document.querySelector("video");
		if (typeof window.updateViewportTransform === "function") {
			window.updateViewportTransform(videoElement);
		} else {
			updateZoom();
		}
		window.triggerPlaybackOverlay(
			`Zoom: ${Math.round(window.zoomLevel * 100)}%`,
		);
	});
	DOM.zoomOut.addEventListener("click", () => {
		const container = document.getElementById("video-wrapper-id");
		const centerX = container.offsetWidth / 2;
		const centerY = container.offsetHeight / 2;

		const oldZoom = window.zoomLevel || 1.0;
		const oldX = window.translateX || 0;
		const oldY = window.translateY || 0;

		let targetZoom = oldZoom - 0.1;
		targetZoom = Math.min(15.0, Math.max(1.0, targetZoom));

		const scaleRatio = targetZoom / oldZoom;

		window.zoomLevel = targetZoom;
		window.translateX = centerX - (centerX - oldX) * scaleRatio;
		window.translateY = centerY - (centerY - oldY) * scaleRatio;

		const videoElement = document.querySelector("video");
		if (typeof window.updateViewportTransform === "function") {
			window.updateViewportTransform(videoElement);
		} else {
			updateZoom();
		}
		window.triggerPlaybackOverlay(
			`Zoom: ${Math.round(window.zoomLevel * 100)}%`,
		);
	});
	DOM.resetZoom.addEventListener("click", () => {
		window.zoomLevel = 1.0;
		window.translateX = 0;
		window.translateY = 0;
		if (typeof window.updateViewportTransform === "function") {
			window.updateViewportTransform(document.querySelector("video"));
		} else {
			updateZoom();
		}
		window.triggerPlaybackOverlay("Zoom Reset");
	});
	if (DOM.takeSnapshotBtn) {
		DOM.takeSnapshotBtn.addEventListener("click", takeSnapshot);
	}
	if (DOM.toggleCinemaBtn) {
		DOM.toggleCinemaBtn.addEventListener("click", (e) => {
			e.preventDefault();
			window.cycleViewMode();
		});
	}
	document.addEventListener("mousemove", resetCinemaIdleTimer);

	marqueeOverlay.addEventListener("mousedown", startMarquee);
	marqueeOverlay.addEventListener("mousemove", drawMarquee);
	marqueeOverlay.addEventListener("mouseup", endMarquee);

	const jumpToPreviousMarker = () => {
		const activeVideo =
			(typeof videoQueue !== "undefined" && videoQueue[activeQueueIndex]) || {};
		const currentMarkers =
			activeVideo.markers || activeVideo.appState?.markers || markers || [];
		if (currentMarkers.length === 0) return;

		const sorted = [...currentMarkers].sort(
			(a, b) => a.startTime - b.startTime,
		);
		const currentTime = player.currentTime;

		const target = [...sorted]
			.reverse()
			.find((m) => m.startTime < currentTime - 0.1);
		if (target) {
			player.currentTime = target.startTime;
		} else {
			player.currentTime = 0;
		}
		player.pause();
	};

	const jumpToNextMarker = () => {
		const activeVideo =
			(typeof videoQueue !== "undefined" && videoQueue[activeQueueIndex]) || {};
		const currentMarkers =
			activeVideo.markers || activeVideo.appState?.markers || markers || [];
		if (currentMarkers.length === 0) return;

		const sorted = [...currentMarkers].sort(
			(a, b) => a.startTime - b.startTime,
		);
		const currentTime = player.currentTime;

		const target = sorted.find((m) => m.startTime > currentTime + 0.1);
		if (target) {
			player.currentTime = target.startTime;
		} else {
			player.currentTime = player.duration;
		}
		player.pause();
	};

	document.addEventListener("keydown", (e) => {
		// Disable shortcuts while Tetris is active to prevent key conflicts (e.g. arrows/spacebar seeking video)
		const tetrisCont = document.getElementById("tetrisContainer");
		if (
			tetrisCont &&
			!tetrisCont.classList.contains("hidden") &&
			tetrisCont.style.display !== "none"
		) {
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
			case ",":
				e.preventDefault();
				if (!player.src) return;
				jumpToPreviousMarker();
				break;
			case ".":
				e.preventDefault();
				if (!player.src) return;
				jumpToNextMarker();
				break;
			case "\\":
				e.preventDefault();
				window.cycleViewMode();
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
			case "t":
			case "T": {
				e.preventDefault();
				const ccBtn = document.getElementById("ccToggleBtn");
				if (ccBtn && !ccBtn.hasAttribute("disabled")) {
					ccBtn.click();
				}
				break;
			}
			case "ArrowLeft":
				e.preventDefault();
				if (!player.src) return;
				player.currentTime = Math.max(
					processStartTime || 0,
					player.currentTime - 1,
				);
				toConsole("Rewind 1s (Left Arrow)", player.currentTime, debuggin);
				break;
			case "ArrowDown":
				e.preventDefault();
				if (!player.src) return;
				player.currentTime = Math.max(
					processStartTime || 0,
					player.currentTime - 5,
				);
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
				window.triggerPlaybackOverlay(`Zoom: ${Math.round(zoomLevel * 100)}%`);
				break;
			case "-":
				e.preventDefault();
				zoomLevel = Math.max(0.1, zoomLevel - 0.2);
				updateZoom();
				window.triggerPlaybackOverlay(`Zoom: ${Math.round(zoomLevel * 100)}%`);
				break;
			case "Backspace":
				e.preventDefault();
				zoomLevel = 1;
				translateX = 0;
				translateY = 0;
				updateZoom();
				window.triggerPlaybackOverlay("Zoom Reset");
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
				if (DOM.speedValue)
					DOM.speedValue.textContent = `${newSpeed.toFixed(1)}x`;
				toConsole("Playback speed shortcut", newSpeed, debuggin);
				saveLocalState();
				window.triggerPlaybackOverlay(`Speed: ${newSpeed.toFixed(1)}x`);
				break;
			}
		}
	});

	window.addEventListener("beforeunload", (e) => {
		if (markers.length > 0 || player.src) {
			e.preventDefault();
			e.returnValue =
				"You have unsaved changes. Are you sure you want to leave?";
			return e.returnValue;
		}
	});

	updateLoadButtonColor();
};

/** Activates mini-player mode layout. */
// Refactored viewing mode functions relocated to unified cycleViewMode cycler engine.

/** Begins drawing the marquee selection box for zooming. */
const startMarquee = (event) => {
	if (event.button !== 0) return;
	if (event.target.closest(".zoom-controls")) return;
	isDrawing = true;
	const rect = marqueeOverlay.getBoundingClientRect();
	startX = event.clientX - rect.left;
	startY = event.clientY - rect.top;

	selectionStart.x = event.clientX;
	selectionStart.y = event.clientY;

	marqueeRect.style.left = `${startX}px`;
	marqueeRect.style.top = `${startY}px`;
	marqueeRect.style.width = "0px";
	marqueeRect.style.height = "0px";
	marqueeRect.style.display = "block";
	toConsole("Marquee start", `(${startX}, ${startY})`, debuggin);
};

/** Updates the dimensions of the marquee selection box while dragging. */
const drawMarquee = (event) => {
	if (!isDrawing) return;
	const rect = marqueeOverlay.getBoundingClientRect();

	const wrapper = document.getElementById("video-wrapper-id");
	const aspect = wrapper.offsetHeight / wrapper.offsetWidth;

	const widthDelta = Math.abs(event.clientX - selectionStart.x);
	const calculatedHeightDelta = widthDelta * aspect;

	let leftStyle = selectionStart.x - rect.left;
	const widthStyle = widthDelta;
	if (event.clientX < selectionStart.x) {
		leftStyle = event.clientX - rect.left;
	}

	let topStyle = selectionStart.y - rect.top;
	const heightStyle = calculatedHeightDelta;
	if (event.clientY < selectionStart.y) {
		topStyle = selectionStart.y - rect.top - calculatedHeightDelta;
	}

	marqueeRect.style.left = `${leftStyle}px`;
	marqueeRect.style.width = `${widthStyle}px`;
	marqueeRect.style.top = `${topStyle}px`;
	marqueeRect.style.height = `${heightStyle}px`;

	selectionEnd.x = event.clientX;
	if (event.clientY >= selectionStart.y) {
		selectionEnd.y = selectionStart.y + calculatedHeightDelta;
	} else {
		selectionEnd.y = selectionStart.y - calculatedHeightDelta;
	}
};

/** Finalizes the marquee selection box and executes viewport zoom. */
const endMarquee = (event) => {
	if (!isDrawing) return;
	if (event.button !== 0) return;
	isDrawing = false;
	marqueeRect.style.display = "none";

	const videoElement = DOM.video;
	const container = document.getElementById("video-wrapper-id");

	const screenWidth = Math.abs(event.clientX - selectionStart.x);
	const screenHeight = Math.abs(event.clientY - selectionStart.y);

	if (screenWidth < 5 || screenHeight < 5) {
		return;
	}

	const boxCenterX =
		Math.min(event.clientX, selectionStart.x) + screenWidth / 2;
	const boxCenterY =
		Math.min(event.clientY, selectionStart.y) + screenHeight / 2;

	const containerRect = container.getBoundingClientRect();
	const relativeCenterX = boxCenterX - containerRect.left;
	const relativeCenterY = boxCenterY - containerRect.top;

	const currentZoom = window.zoomLevel || 1.0;
	const currentX = window.translateX || 0;
	const currentY = window.translateY || 0;

	const scaleMultiplier = Math.min(
		container.offsetWidth / screenWidth,
		container.offsetHeight / screenHeight,
	);

	let finalZoom = currentZoom * scaleMultiplier;
	finalZoom = Math.min(15.0, Math.max(1.0, finalZoom));

	window.zoomLevel = finalZoom;
	window.translateX =
		container.offsetWidth / 2 -
		((container.offsetWidth / 2 - currentX) * scaleMultiplier +
			(boxCenterX - (containerRect.left + container.offsetWidth / 2)) *
				scaleMultiplier);
	window.translateY =
		container.offsetHeight / 2 -
		((container.offsetHeight / 2 - currentY) * scaleMultiplier +
			(boxCenterY - (containerRect.top + container.offsetHeight / 2)) *
				scaleMultiplier);

	toConsole(
		"New viewport settings from marquee",
		`Zoom: ${window.zoomLevel}, Translate: (${window.translateX}, ${window.translateY})`,
		debuggin,
	);

	if (typeof window.updateViewportTransform === "function") {
		window.updateViewportTransform(videoElement);
	} else {
		videoElement.style.transformOrigin = "0px 0px";
		videoElement.style.transform = `translate(${window.translateX}px, ${window.translateY}px) scale(${window.zoomLevel})`;
	}
};

/** Applies the current zoom and translation transform to the video element. */
const updateZoom = () => {
	const video = DOM.video;
	if (typeof window.updateViewportTransform === "function") {
		if (window.viewportState) {
			window.viewportState.syncFromGlobals();
		}
		window.updateViewportTransform(video);
	} else {
		video.style.transform = `scale(${zoomLevel}) translate(${translateX}px, ${translateY}px)`;
	}
	toConsole(
		"Zoom updated",
		`Level: ${zoomLevel}, Translate: (${translateX}, ${translateY})`,
		debuggin,
	);
};

/** Synchronizes timeline playheads, looping state, and UI on video time update. */
const seektimeupdate = () => {
	if (player && playerReady) {
		// Absolute DOM Overwrite Container Protection
		if (!window.currentCaptions || window.currentCaptions.length === 0) {
			const ccDisplay = document.getElementById("cc-output");
			if (ccDisplay) {
				ccDisplay.innerHTML = "";
			}
		}

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

		if (duration > 0) {
			const pct = (currentTime / duration) * 100;
			const playheads = document.querySelectorAll(".sequencer-playhead");
			for (const ph of playheads) {
				ph.style.left = `${pct}%`;
			}
		}

		// Playhead Execution Logic: Jump & Loop
		if (markers && markers.length > 0) {
			const activeVideo =
				(typeof videoQueue !== "undefined" && videoQueue[activeQueueIndex]) ||
				{};
			const endLimit =
				activeVideo.virtualEndTime !== null &&
				activeVideo.virtualEndTime !== undefined
					? activeVideo.virtualEndTime
					: duration || player.duration || 0;

			for (let j = 0; j < markers.length; j += 1) {
				const currentMarker = markers[j];
				const nextMarker = markers[j + 1];
				const boundaryTime = nextMarker ? nextMarker.startTime : endLimit;

				if (currentMarker.type === "jump") {
					if (
						currentTime >= currentMarker.startTime &&
						currentTime < boundaryTime
					) {
						player.currentTime = boundaryTime;
						return;
					}
				} else if (currentMarker.type === "loop") {
					const video = player;
					const marker = currentMarker;

					const subsequentMarkers = markers
						.filter((m) => m.startTime > marker.startTime)
						.sort((a, b) => a.startTime - b.startTime);

					const computedLoopEnd =
						subsequentMarkers.length > 0
							? subsequentMarkers[0].startTime
							: video.duration;
					const loopEndThreshold = computedLoopEnd - 0.3;

					if (
						video.currentTime >= marker.startTime &&
						video.currentTime < loopEndThreshold
					) {
						if (
							window.activeLoopId !== marker.id &&
							window.activeLoopId !== `exhausted_${marker.id}`
						) {
							window.activeLoopId = marker.id;
							window.activeLoopCount = 0;
						}
					}

					if (video.currentTime >= loopEndThreshold) {
						if (window.activeLoopId === marker.id) {
							if (window.activeLoopCount + 1 < (marker.loopCount || 1)) {
								window.activeLoopCount++;
								video.currentTime = marker.startTime;
								video.play();
							} else {
								window.activeLoopId = `exhausted_${marker.id}`;
							}
						}
					}

					if (
						video.currentTime < marker.startTime - 0.5 ||
						video.currentTime > computedLoopEnd + 0.5
					) {
						if (
							window.activeLoopId === marker.id ||
							window.activeLoopId === `exhausted_${marker.id}`
						) {
							window.activeLoopId = null;
							window.activeLoopCount = 0;
						}
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

/** Redraws visual ticks for markers and process boundaries on the seek bar. */
const updateSliderTicks = () => {
	if (!DOM.startTick || !DOM.endTick) return;

	if (DOM.markerTicksContainer) {
		DOM.markerTicksContainer.innerHTML = "";
	}
	DOM.startTick.classList.add("hidden");
	if (DOM.startGreyOut) DOM.startGreyOut.classList.add("hidden");
	DOM.endTick.classList.add("hidden");
	if (DOM.endGreyOut) DOM.endGreyOut.classList.add("hidden");

	if (!player?.duration) return;

	if (processStartTime > 0) {
		const startPct = (processStartTime / player.duration) * 100;
		DOM.startTick.style.left = `calc(${startPct}% - 1px)`;
		DOM.startTick.classList.remove("hidden");
		if (DOM.startGreyOut) {
			DOM.startGreyOut.style.width = `${startPct}%`;
			DOM.startGreyOut.classList.remove("hidden");
		}
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

/** Formats and outputs the video time to the specified DOM element. */
const updateTimeDisplay = (seconds, elementId) => {
	DOM[elementId].textContent = formatTimeToHHMMSSMS(seconds);
};

/** Repositions control bar dynamically based on video dimensions. */
const positionControls = () => {
	const controlsBar = document.getElementById("video_controls_bar");
	if (controlsBar) {
		controlsBar.style.position = "relative";
		toConsole("Controls repositioned after video load", "Success", debuggin);
	}
};

/** Updates the load video button visual styling based on player load state. */
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

/** Toggles the visibility of the "no video loaded" placeholder element. */
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
		alert(
			"Failed to toggle video placeholder. Please check the console for details.",
		);
	}
};

/** Opens or closes the settings side panel. */
const toggleSettings = (show) => {
	if (!DOM.settingsPanel || !DOM.settingsBackdrop) return;
	if (show) {
		DOM.settingsBackdrop.classList.remove("hidden");
		requestAnimationFrame(() => {
			DOM.settingsBackdrop.classList.remove("opacity-0");
			DOM.settingsPanel.classList.remove("translate-x-full");
		});
		if (DOM.projectCommentsInput)
			DOM.projectCommentsInput.value = projectComments || "";
	} else {
		DOM.settingsPanel.classList.add("translate-x-full");
		DOM.settingsBackdrop.classList.add("opacity-0");
		setTimeout(() => DOM.settingsBackdrop.classList.add("hidden"), 300);
	}
};

/** Inserts a new standard marker at the current video playback time. */
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

/** Renames an existing marker at the given index. */
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
		toggleSettings(true);
		if (typeof window.resetTrimModalUI === "function") {
			window.resetTrimModalUI();
		}
		if (typeof window.activateTetris === "function") {
			window.activateTetris();
		}
		updateMarkersList();
		return;
	}
	markers[markerIndex].name = trimmed;
	saveLocalState();
};

/** Updates the behavioral type of an existing marker. */
const updateMarkerType = (markerIndex, newType) => {
	markers[markerIndex].type = newType;
	saveLocalState();
	updateVideoTimeSummary();
	updateMarkersList();
};

/** Prompts for confirmation and deletes the specified marker. */
const deleteMarker = async (markerIndex) => {
	if (
		await asyncConfirm(
			`Are you sure you want to delete the marker "${markers[markerIndex].name}"? This action cannot be undone.`,
			"Delete Marker",
		)
	) {
		markers.splice(markerIndex, 1);
		toConsole(
			`Deleted marker at index ${markerIndex}`,
			`Total markers left: ${markers.length}`,
			debuggin,
		);
		saveLocalState();
		updateMarkersList();
	}
};

/** Seeks the video player to the target marker start or end time and pauses. */
const jumpToMarkerTime = (markerIndexOrTime, type) => {
	if (!player.src) {
		alert("Please load a video first.");
		return;
	}
	window.currentLoopCount = 0;
	window.activeLoopMarkerId = null;
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

/** Seeks the video player to the target marker time and initiates playback. */
const playFromMarkerTime = (markerIndexOrTime, type) => {
	if (!player.src) {
		alert("Please load a video first.");
		return;
	}
	window.currentLoopCount = 0;
	window.activeLoopMarkerId = null;
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

/** Updates the start time of the specified marker to the current playhead. */
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

/** Parses the FFmpeg log output to extract timestamp and update progress. */
function parseFFmpegTime(line, totalSeconds, progressBar) {
	if (!line) return;
	const match = line.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
	if (match) {
		const hours = Number.parseInt(match[1], 10);
		const minutes = Number.parseInt(match[2], 10);
		const seconds = Number.parseFloat(match[3]);
		const currentSeconds = hours * 3600 + minutes * 60 + seconds;
		if (totalSeconds > 0 && progressBar) {
			const pct = Math.floor((currentSeconds / totalSeconds) * 100);
			progressBar.value = Math.min(100, Math.max(0, pct));
		}
	}
}

/** Binds events and logic for video trimming modal and batch export. */
// Video Trimming & Compression Feature
const initializeTrimFeature = () => {
	const isTauri = window.__TAURI__ !== undefined;
	if (!isTauri) return;

	const trimVideoBtn = document.getElementById("trimVideoBtn");
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
			document.getElementById("trimStartInput").value =
				formatTimeToHHMMSSMS(processStartTime);
			document.getElementById("trimEndInput").value = formatTimeToHHMMSSMS(
				processEndTime || player.duration,
			);
			resetTrimModalUI();
			toggleSettings(true);
		});
	}

	const resetTrimModalUI = () => {
		if (trimOnlyBtn) trimOnlyBtn.disabled = false;
		if (trimCompressBtn) trimCompressBtn.disabled = false;
		if (cancelTrimBtn) {
			cancelTrimBtn.disabled = false;
			cancelTrimBtn.className = "btn btn-outline-secondary";
			cancelTrimBtn.textContent = "Cancel";
		}
		document.getElementById("trimProgressContainer").classList.add("hidden");
		const spinner = document.getElementById("trimProgressSpinner");
		if (spinner) spinner.classList.add("hidden");

		const batchExportToggle = document.getElementById("batchExportToggle");
		const batchExportList = document.getElementById("batch-export-list");
		if (batchExportToggle) batchExportToggle.checked = false;
		if (batchExportList) {
			batchExportList.classList.add("hidden");
			batchExportList.innerHTML = "";
		}

		if (trimOnlyBtn) trimOnlyBtn.style.display = "inline-flex";
		if (trimCompressBtn) trimCompressBtn.style.display = "inline-flex";
		const joinBtn = document.getElementById("joinAndCompressBtn");
		if (joinBtn) joinBtn.style.display = "none";

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

	const batchExportToggle = document.getElementById("batchExportToggle");
	const batchExportList = document.getElementById("batch-export-list");
	if (batchExportToggle) {
		batchExportToggle.addEventListener("change", () => {
			if (batchExportToggle.checked) {
				batchExportList.classList.remove("hidden");
				renderBatchExportList();
			} else {
				batchExportList.classList.add("hidden");
			}
		});
	}

	const renderBatchExportList = () => {
		if (!batchExportList) return;
		batchExportList.innerHTML = `
      <div class="flex items-center justify-between mb-2 px-1">
        <span class="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Queue</span>
        <label class="flex items-center gap-2 cursor-pointer group" title="Merge selected videos into a single file">
          <span class="text-xs font-medium text-zinc-700 dark:text-zinc-300 select-none group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Join Videos</span>
          <div class="relative">
            <input type="checkbox" id="joinFilesToggle" class="sr-only peer">
            <div class="w-8 h-4 bg-zinc-300 dark:bg-zinc-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
          </div>
        </label>
      </div>
    `;

		videoQueue.forEach((video, index) => {
			const row = document.createElement("div");
			row.className =
				"flex items-center justify-between gap-3 p-2 mb-1.5 bg-zinc-50 dark:bg-zinc-800/40 rounded border border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm";
			row.innerHTML = `
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <input type="checkbox" data-index="${index}" checked class="batch-video-checkbox rounded text-blue-600 focus:ring-blue-500 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 w-4 h-4 cursor-pointer" />
          <span class="font-medium truncate dark:text-zinc-300" title="${video.videoFileName || "Unknown Video"}">${video.videoFileName || "Unknown Video"}</span>
        </div>
        <div class="flex items-center gap-3 w-40 justify-end">
          <progress id="batch-progress-${index}" value="0" max="100" class="w-24 h-1.5 rounded overflow-hidden bg-zinc-200 dark:bg-zinc-700 accent-blue-600"></progress>
          <div id="batch-status-${index}" class="w-5 h-5 flex items-center justify-center text-zinc-400">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>
          </div>
        </div>
      `;
			batchExportList.appendChild(row);
		});

		let joinBtn = document.getElementById("joinAndCompressBtn");
		if (!joinBtn) {
			joinBtn = document.createElement("button");
			joinBtn.type = "button";
			joinBtn.id = "joinAndCompressBtn";
			joinBtn.className = "btn btn-primary font-bold tracking-wide";
			joinBtn.style.display = "none";
			joinBtn.textContent = "Join & Compress Selected";
			if (trimCompressBtn?.parentNode) {
				trimCompressBtn.parentNode.insertBefore(
					joinBtn,
					trimCompressBtn.nextSibling,
				);
			}

			joinBtn.addEventListener("click", () => {
				const checkboxes = document.querySelectorAll(".batch-video-checkbox");
				const checkedSegments = [];
				checkboxes.forEach((cb) => {
					if (cb.checked) {
						const idx = Number.parseInt(cb.getAttribute("data-index"), 10);
						const vid = videoQueue[idx];
						if (vid?.videoFilePath) {
							const activeMarkers = vid.appState?.markers || [];
							const loopMarker = activeMarkers.find((m) => m.type === "loop");
							checkedSegments.push({
								path: vid.videoFilePath,
								start_time: vid.processStartTime || 0.0,
								end_time: vid.processEndTime || 0.0,
								loopCount: loopMarker ? loopMarker.loopCount || 1 : 1,
							});
						}
					}
				});
				if (window.joinAndCompressVideos) {
					window.joinAndCompressVideos(checkedSegments);
				}
			});
		}

		const joinFilesToggle = document.getElementById("joinFilesToggle");
		joinFilesToggle.addEventListener("change", (e) => {
			if (e.target.checked) {
				if (joinBtn) joinBtn.style.display = "inline-flex";
				if (trimOnlyBtn) trimOnlyBtn.style.display = "none";
				if (trimCompressBtn) trimCompressBtn.style.display = "none";
			} else {
				if (joinBtn) joinBtn.style.display = "none";
				if (trimOnlyBtn) trimOnlyBtn.style.display = "inline-flex";
				if (trimCompressBtn) trimCompressBtn.style.display = "inline-flex";
			}
		});
	};

	const handleCancelClick = async () => {
		if (activeFFmpegChild) {
			isAborted = true;
			toConsole(
				"User clicked cancel: Aborting FFmpeg process...",
				null,
				debuggin,
			);
			try {
				await activeFFmpegChild.kill();
				showToast("Processing aborted by user.", "warning");
			} catch (e) {
				toConsole("Error killing FFmpeg process", e, debuggin);
			}
			activeFFmpegChild = null;
		}
		toggleSettings(false);
		resetTrimModalUI();
	};

	const closeTrim = () => {
		const tetrisCont = document.getElementById("tetrisContainer");
		if (window.isSecretGame) {
			window.isSecretGame = false;
			handleCancelClick();
		} else if (
			tetrisCont &&
			!tetrisCont.classList.contains("hidden") &&
			tetrisCont.style.display !== "none"
		) {
			toConsole(
				"X clicked in Tetris mode, returning to progress screen",
				null,
				debuggin,
			);
			if (typeof window.showNormalProgressScreen === "function") {
				window.showNormalProgressScreen();
			}
		} else {
			handleCancelClick();
		}
	};

	if (cancelTrimBtn) cancelTrimBtn.addEventListener("click", closeTrim);

	if (trimOnlyBtn) {
		trimOnlyBtn.addEventListener("click", () => executeExport("copy"));
	}
	if (trimCompressBtn) {
		trimCompressBtn.addEventListener("click", () => {
			const preset = document.querySelector(
				'input[name="trimQuality"]:checked',
			).value;
			executeExport(preset);
		});
	}
};

/** Calculates contiguous logical segments to retain based on marker states. */
const getExportSegments = (markersList, videoDuration) => {
	const sortedMarkers = [...markersList].sort(
		(a, b) => a.startTime - b.startTime,
	);

	let inTime = 0;
	let outTime = videoDuration || 0;

	const inMarker = sortedMarkers.find((m) => m.type === "in");
	if (inMarker) {
		inTime = inMarker.startTime;
	}

	const outMarker = sortedMarkers.find((m) => m.type === "out");
	if (outMarker) {
		outTime = outMarker.startTime;
	}

	const segmentsToKeep = [];
	let keeping = true;
	let currentStart = inTime;

	for (let i = 0; i < sortedMarkers.length; i += 1) {
		const marker = sortedMarkers[i];
		if (marker.startTime <= inTime || marker.startTime >= outTime) {
			continue;
		}

		if (marker.type === "loop") {
			if (keeping && marker.startTime > currentStart) {
				segmentsToKeep.push({
					start: currentStart,
					end: marker.startTime,
					loopCount: 1,
				});
			}
			const nextMarker = sortedMarkers
				.slice(i + 1)
				.find((m) => m.startTime > marker.startTime && m.startTime < outTime);
			const boundaryTime = nextMarker ? nextMarker.startTime : outTime;

			segmentsToKeep.push({
				start: marker.startTime,
				end: boundaryTime,
				loopCount: marker.loopCount !== undefined ? marker.loopCount : 1,
			});

			keeping = true;
			currentStart = boundaryTime;
		} else if (keeping && marker.type === "jump") {
			if (marker.startTime > currentStart) {
				segmentsToKeep.push({
					start: currentStart,
					end: marker.startTime,
					loopCount: 1,
				});
			}
			keeping = false;
		} else if (!keeping && marker.type !== "jump") {
			keeping = true;
			currentStart = marker.startTime;
		}
	}

	if (keeping && outTime > currentStart) {
		segmentsToKeep.push({ start: currentStart, end: outTime, loopCount: 1 });
	}

	return segmentsToKeep;
};

/** Executes the FFmpeg export pipeline across all selected videos in the queue. */
async function processBatchQueue(presetType) {
	const isTauri = window.__TAURI__ !== undefined;
	if (!isTauri) {
		alert("Tauri desktop API is required for batch exporting.");
		return;
	}

	const checkboxes = document.querySelectorAll(".batch-video-checkbox");
	const checkedIndices = [];
	checkboxes.forEach((cb) => {
		if (cb.checked) {
			checkedIndices.push(Number.parseInt(cb.getAttribute("data-index"), 10));
		}
	});

	if (checkedIndices.length === 0) {
		alert("Please select at least one video to export.");
		return;
	}

	const openDialog = window.__TAURI__ ? window.__TAURI__.dialog.open : null;
	if (!openDialog) {
		alert("Tauri dialog API not available.");
		return;
	}
	const targetDir = await openDialog({
		directory: true,
		multiple: false,
		title: "Select Output Folder for Batch",
	});
	if (!targetDir) {
		console.log("Batch cancelled.");
		return;
	}

	const actualOutputDir =
		typeof targetDir === "object" ? targetDir.path : targetDir;

	const trimOnlyBtn = document.getElementById("trimOnlyBtn");
	const trimCompressBtn = document.getElementById("trimCompressBtn");
	const cancelTrimBtn = document.getElementById("cancelTrimBtn");

	if (trimOnlyBtn) trimOnlyBtn.disabled = true;
	if (trimCompressBtn) trimCompressBtn.disabled = true;
	if (cancelTrimBtn) {
		cancelTrimBtn.disabled = false;
		cancelTrimBtn.className = "btn btn-danger";
		cancelTrimBtn.textContent = "Abort Batch";
	}

	const originalMarkers = [...markers];
	const originalVideoFileName = videoFileName;
	const originalVideoFilePath = videoFilePath;

	isAborted = false;

	try {
		for (const index of checkedIndices) {
			if (isAborted) break;

			const video = videoQueue[index];
			if (!video) continue;

			const rowContainer = document.getElementById(`batch-status-${index}`)
				?.parentElement?.parentElement;
			if (rowContainer) {
				rowContainer.classList.add("border-blue-500", "bg-blue-50/10");
			}

			const statusIconContainer = document.getElementById(
				`batch-status-${index}`,
			);
			if (statusIconContainer) {
				statusIconContainer.innerHTML = `
          <svg class="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        `;
			}

			const specificProgressBar = document.getElementById(
				`batch-progress-${index}`,
			);
			if (specificProgressBar) {
				specificProgressBar.value = 0;
			}

			let baseName = video.videoFileName || `video_${index + 1}`;
			const lastDot = baseName.lastIndexOf(".");
			if (lastDot !== -1) {
				baseName = baseName.substring(0, lastDot);
			}
			const exportName = `${baseName}_export.mp4`;

			let actualOutputPath = exportName;
			if (join) {
				actualOutputPath = await join(actualOutputDir, exportName);
			} else {
				actualOutputPath = `${actualOutputDir}/${exportName}`;
			}

			let tempFilePath = null;

			try {
				markers = video.appState?.markers || [];
				markers.forEach((m) => {
					if (!m.type) m.type = "standard";
				});

				videoFileName = video.videoFileName || "";
				videoFilePath = video.videoFilePath || "";

				const segments = getExportSegments(markers, video.processEndTime || 0);

				if (segments.length === 0) {
					throw new Error("No segments to export.");
				}

				const exportDuration = segments.reduce(
					(sum, seg) => sum + (seg.end - seg.start) * (seg.loopCount || 1),
					0,
				);

				const safePath = video.videoFilePath.replace(/\\/g, "/");
				let listContent = "";
				for (const seg of segments) {
					const loopCount = seg.loopCount || 1;
					for (let l = 0; l < loopCount; l++) {
						listContent += `file '${safePath}'\n`;
						listContent += `inpoint ${seg.start}\n`;
						listContent += `outpoint ${seg.end}\n`;
					}
				}

				if (tempdir && join) {
					const tempDir = await tempdir();
					tempFilePath = await join(
						tempDir,
						`ffmpeg_concat_batch_${video.videoId || index}.txt`,
					);
				} else {
					tempFilePath = `${actualOutputPath.substring(0, actualOutputPath.lastIndexOf("."))}_concat_list.txt`;
				}
				await writeTextFile(tempFilePath, listContent);

				const isCompression = presetType !== "copy";
				const args = [
					"-y",
					"-nostdin",
					"-nostats",
					"-f",
					"concat",
					"-safe",
					"0",
					"-i",
					tempFilePath,
					"-progress",
					"pipe:2",
				];

				if (!isCompression) {
					args.push("-c", "copy");
				} else {
					const targetHeight = presetType === "low" ? 720 : 1080;
					args.push(
						"-vf",
						`scale=-2:${targetHeight}`,
						"-c:v",
						"libx264",
						"-crf",
						presetType === "low" ? "32" : presetType === "high" ? "18" : "26",
						"-preset",
						presetType === "low"
							? "veryfast"
							: presetType === "high"
								? "medium"
								: "fast",
						"-threads",
						"4",
					);
					args.push("-c:a", "copy", "-max_muxing_queue_size", "4096");
				}
				args.push(actualOutputPath);

				toConsole("Spawning FFmpeg sidecar for batch item", { args }, debuggin);

				if (!Command) {
					throw new Error("Tauri Command API is not loaded.");
				}

				const ffmpeg = Command.sidecar("binaries/ffmpeg", args);
				let ffmpegChild = null;

				activeFFmpegChild = {
					kill: async () => {
						isAborted = true;
						if (ffmpegChild) {
							await ffmpegChild.kill();
						}
					},
				};

				const onLine = (line) => {
					parseFFmpegTime(line, exportDuration, specificProgressBar);
				};
				ffmpeg.on("line", onLine);
				if (ffmpeg.stderr) {
					ffmpeg.stderr.on("data", onLine);
				}

				ffmpegChild = await ffmpeg.spawn();
				try {
					await new Promise((resolve, reject) => {
						ffmpeg.on("close", ({ code }) => {
							if (code === 0) resolve();
							else reject(new Error(`FFmpeg exited with code ${code}`));
						});
						ffmpeg.on("error", (error) => reject(error));
					});
				} finally {
					if (tempFilePath && remove) {
						try {
							const fileExists = exists ? await exists(tempFilePath) : true;
							if (fileExists) {
								await remove(tempFilePath);
							}
						} catch (e) {
							console.warn("Failed to delete temp file:", e);
						}
					}
				}

				if (specificProgressBar) {
					specificProgressBar.value = 100;
					specificProgressBar.classList.add("opacity-50");
				}

				if (statusIconContainer) {
					statusIconContainer.innerHTML = `
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          `;
				}

				const remapTime = (t, segs) => {
					let newTime = 0;
					for (let i = 0; i < segs.length; i++) {
						const seg = segs[i];
						if (t < seg.start) {
							break;
						}
						if (t >= seg.start && t <= seg.end) {
							newTime += t - seg.start;
							break;
						}
						newTime += seg.end - seg.start;
					}
					return newTime;
				};

				const currentMarkers = video.appState?.markers || [];
				const remappedMarkers = [];
				for (const m of currentMarkers) {
					if (m.type === "in" || m.type === "out" || m.type === "jump")
						continue;
					const newStart = remapTime(m.startTime, segments);
					remappedMarkers.push({
						...m,
						startTime: newStart,
					});
				}

				video.appState.markers = remappedMarkers;
				video.processStartTime = 0;
				video.processEndTime = exportDuration;
			} catch (fileErr) {
				toConsole("Batch item processing failed", fileErr, debuggin);
				if (statusIconContainer) {
					statusIconContainer.innerHTML = `
            <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          `;
				}
			} finally {
				if (rowContainer) {
					rowContainer.classList.remove("border-blue-500", "bg-blue-50/10");
				}
			}
		}

		saveLocalState();
		markers = videoQueue[activeQueueIndex]?.appState?.markers || [];
		updateMarkersList();

		if (isAborted) {
			showToast("Batch processing aborted.", "warning");
		} else {
			showToast("Batch export completed!", "success");
		}
	} finally {
		markers = originalMarkers;
		videoFileName = originalVideoFileName;
		videoFilePath = originalVideoFilePath;
		resetTrimModalUI();
	}
}

/** Triggers the single-video FFmpeg compression and trim export routine. */
async function executeExport(presetType) {
	const batchExportToggle = document.getElementById("batchExportToggle");
	const batchMode = batchExportToggle ? batchExportToggle.checked : false;

	if (batchMode) {
		await processBatchQueue(presetType);
		return;
	}

	if (!videoFilePath) {
		alert("Please load a video file first.");
		return;
	}

	const trimOnlyBtn = document.getElementById("trimOnlyBtn");
	const trimCompressBtn = document.getElementById("trimCompressBtn");
	const originalTrimOnlyText = trimOnlyBtn
		? trimOnlyBtn.textContent
		: "Trim Only (Copy)";
	const originalTrimCompressText = trimCompressBtn
		? trimCompressBtn.textContent
		: "Trim & Compress";

	if (trimOnlyBtn) {
		trimOnlyBtn.textContent = "Exporting...";
		trimOnlyBtn.disabled = true;
	}
	if (trimCompressBtn) {
		trimCompressBtn.textContent = "Exporting...";
		trimCompressBtn.disabled = true;
	}

	isAborted = false;
	let watchdogTimer = null;
	let unlistenStderr = null;
	let tempFilePath = null;
	const stderrLogs = [];

	try {
		const segments = getExportSegments(
			markers,
			player?.duration ? player.duration : 0,
		);
		if (segments.length === 0) {
			throw new Error("No segments to export.");
		}

		const defaultPath = `trimmed_${videoFileName || "video.mp4"}`;
		toConsole("Opening Tauri save dialog...", { defaultPath }, debuggin);

		let outputPath;
		try {
			outputPath = await window.__TAURI__?.dialog?.save?.({
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

		const actualOutputPath =
			typeof outputPath === "object" ? outputPath.path : outputPath;
		toConsole("Save path selected", actualOutputPath, debuggin);

		if (
			videoFilePath &&
			actualOutputPath &&
			videoFilePath.toLowerCase() === actualOutputPath.toLowerCase()
		) {
			toConsole(
				"executeExport abort: Input and output paths are identical",
				actualOutputPath,
				debuggin,
			);
			throw new Error("Input and output paths are identical.");
		}

		// Map input video path to use forward slashes (FFmpeg concat demuxer preference)
		const safePath = videoFilePath.replace(/\\/g, "/");

		// Build the demuxer list string
		let listContent = "";
		for (const seg of segments) {
			const loopCount = seg.loopCount || 1;
			for (let l = 0; l < loopCount; l++) {
				listContent += `file '${safePath}'\n`;
				listContent += `inpoint ${seg.start}\n`;
				listContent += `outpoint ${seg.end}\n`;
			}
		}

		// Write the list file to tempdir (or fallback to output dir if os/path plugins are not loaded)
		if (tempdir && join) {
			const tempDir = await tempdir();
			tempFilePath = await join(tempDir, "ffmpeg_concat_list.txt");
		} else {
			tempFilePath = `${actualOutputPath.substring(0, actualOutputPath.lastIndexOf("."))}_concat_list.txt`;
		}
		await writeTextFile(tempFilePath, listContent);

		// Build FFmpeg args
		const isCompression = presetType !== "copy";
		const args = [
			"-y",
			"-nostdin",
			"-nostats",
			"-f",
			"concat",
			"-safe",
			"0",
			"-i",
			tempFilePath,
			"-progress",
			"pipe:2",
		];

		if (!isCompression) {
			args.push("-c", "copy");
		} else {
			const inputHeight = player.videoHeight || 0;
			let targetHeight = 1080;
			if (presetType === "low") {
				targetHeight = 720;
			}
			if (inputHeight > 0 && inputHeight < targetHeight) {
				targetHeight = inputHeight;
			}

			if (presetType === "low") {
				args.push(
					"-vf",
					`scale=-2:${targetHeight}`,
					"-c:v",
					"libx264",
					"-crf",
					"32",
					"-preset",
					"veryfast",
					"-threads",
					"4",
				);
			} else if (presetType === "high") {
				args.push(
					"-vf",
					`scale=-2:${targetHeight}`,
					"-c:v",
					"libx264",
					"-crf",
					"18",
					"-preset",
					"medium",
					"-threads",
					"4",
				);
			} else {
				args.push(
					"-vf",
					`scale=-2:${targetHeight}`,
					"-c:v",
					"libx264",
					"-crf",
					"26",
					"-preset",
					"fast",
					"-threads",
					"4",
				);
			}
			args.push("-c:a", "copy", "-max_muxing_queue_size", "4096");
		}

		args.push(actualOutputPath);
		toConsole("Spawning FFmpeg with args", args, debuggin);

		const progressContainer = document.getElementById("trimProgressContainer");
		const progressBar = document.getElementById("trimProgressBar");
		const progressText = document.getElementById("trimProgressText");
		const spinner = document.getElementById("trimProgressSpinner");

		progressContainer.classList.remove("hidden");
		if (spinner) spinner.classList.remove("hidden");
		progressBar.style.width = "0%";
		progressText.textContent = "0%";

		const duration = segments.reduce(
			(sum, seg) => sum + (seg.end - seg.start) * (seg.loopCount || 1),
			0,
		);
		let lastPct = -1;

		const WATCHDOG_MS = 30_000;
		const resetWatchdog = () => {
			clearTimeout(watchdogTimer);
			watchdogTimer = setTimeout(async () => {
				toConsole(
					"FFmpeg watchdog: no progress for 30s — aborting",
					null,
					debuggin,
				);
				isAborted = true;
				try {
					await window.__TAURI__?.core?.invoke?.("abort_ffmpeg");
					toConsole("FFmpeg watchdog kill: success", null, debuggin);
				} catch (killErr) {
					toConsole("FFmpeg watchdog kill: failed", killErr, debuggin);
				}
			}, WATCHDOG_MS);
		};

		resetWatchdog();

		activeFFmpegChild = {
			kill: async () => {
				try {
					await window.__TAURI__?.core?.invoke?.("abort_ffmpeg");
				} catch (e) {
					toConsole("Error aborting ffmpeg via invoke", e, debuggin);
				}
			},
		};

		unlistenStderr = await window.__TAURI__?.event?.listen?.(
			"ffmpeg-stderr",
			(event) => {
				const line = event.payload || "";
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

				const match = line.match(/out_time_us=(\d+)/);
				if (match) {
					resetWatchdog();
					const val = Number.parseInt(match[1], 10);
					const currentSeconds = val / 1_000_000;
					if (duration > 0) {
						const pct = Math.min(
							100,
							Math.max(0, Math.round((currentSeconds / duration) * 100)),
						);
						if (pct !== lastPct) {
							lastPct = pct;
							toConsole(
								"FFmpeg progress percentage updated",
								{ pct, currentSeconds, duration },
								debuggin,
							);
							progressBar.style.width = `${pct}%`;
							progressText.textContent = `${pct}%`;
							if (typeof window.updateTetrisProgress === "function") {
								window.updateTetrisProgress(pct);
							}
						}
					}
				}
			},
		);

		toConsole(
			"Spawning FFmpeg sidecar process via Rust backend...",
			null,
			debuggin,
		);
		try {
			await window.__TAURI__?.core?.invoke?.("run_ffmpeg", { args });
		} finally {
			if (tempFilePath && remove) {
				try {
					const fileExists = exists ? await exists(tempFilePath) : true;
					if (fileExists) {
						await remove(tempFilePath);
					}
				} catch (e) {
					console.warn("Failed to delete temp file:", e);
				}
			}
		}

		progressBar.style.width = "100%";
		progressText.textContent = "100%";

		if (spinner) spinner.classList.add("hidden");

		// Remap remaining bookmark/marker timestamps to account for physically removed segments
		const remapTime = (t, segs) => {
			let newTime = 0;
			for (let i = 0; i < segs.length; i++) {
				const seg = segs[i];
				if (t < seg.start) {
					return newTime;
				}
				if (t >= seg.start && t <= seg.end) {
					return newTime + (t - seg.start);
				}
				newTime += seg.end - seg.start;
			}
			return newTime;
		};

		const updatedMarkers = [];
		for (let i = 0; i < markers.length; i += 1) {
			const marker = markers[i];
			if (marker.type === "jump") {
				continue;
			}
			marker.startTime = remapTime(marker.startTime, segments);
			if (marker.endTime) {
				marker.endTime = remapTime(marker.endTime, segments);
			}
			updatedMarkers.push(marker);
		}
		markers.length = 0;
		markers.push(...updatedMarkers);

		processStartTime = 0;
		processEndTime = duration;

		videoFilePath = actualOutputPath;
		videoFileName = actualOutputPath.replace(/^.*[\\/]/, "");

		const tauriAssetUrl =
			window.__TAURI__?.core?.convertFileSrc?.(videoFilePath);
		player.src = tauriAssetUrl;
		player.preload = "auto";
		player.load();
		toggleVideoPlaceholder(false);
		window.loadSubtitleTrack(videoFilePath);

		saveLocalState();
		updateMarkersList();

		const tetrisCont = document.getElementById("tetrisContainer");
		if (
			typeof window.onVideoProcessingFinished === "function" &&
			tetrisCont &&
			!tetrisCont.classList.contains("hidden")
		) {
			showToast("Video completed.", "success");
			window.onVideoProcessingFinished();
		} else {
			toggleSettings(false);
			if (typeof window.resetTrimModalUI === "function") {
				window.resetTrimModalUI();
			}

			showToast("Video completed.", "success");

			const saveConfirm = await asyncConfirm(
				"Timestamps shifted. Save project changes now?",
				"Save Project",
			);
			if (saveConfirm) {
				await exportToJSON(false);
			}
		}
	} catch (err) {
		toConsole("FFmpeg process failed or aborted", err, debuggin);
		if (isAborted) {
			alert("Export aborted by user.");
		} else {
			const fullErrLogs = stderrLogs ? stderrLogs.join("\n") : "";
			alert(
				`Export failed: ${err.message || err}\n\nFFmpeg Logs:\n${fullErrLogs || "(no stderr output)"}`,
			);
		}
	} finally {
		clearTimeout(watchdogTimer);
		activeFFmpegChild = null;
		if (unlistenStderr) {
			unlistenStderr();
		}
		if (tempFilePath && remove) {
			try {
				const fileExists = exists ? await exists(tempFilePath) : true;
				if (fileExists) {
					await remove(tempFilePath);
				}
			} catch (e) {
				console.warn("Failed to delete temp file:", e);
			}
		}
		if (trimOnlyBtn) {
			trimOnlyBtn.textContent = originalTrimOnlyText;
			trimOnlyBtn.disabled = false;
		}
		if (trimCompressBtn) {
			trimCompressBtn.textContent = originalTrimCompressText;
			trimCompressBtn.disabled = false;
		}
	}
}

// 4. Left Sidebar Playlist Interface Utilities (Populators, Row Re-indexers, Shuffling Loops)
/** Renders the video queue options in the DOM select. */
const renderVideoQueueSelect = () => {
	if (!DOM.videoQueueSelect) return;
	DOM.videoQueueSelect.innerHTML = "";
	for (const [index, video] of videoQueue.entries()) {
		const option = document.createElement("option");
		option.value = index;
		option.textContent = video.videoFileName || "Unknown File";
		option.className =
			"bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white";
		DOM.videoQueueSelect.appendChild(option);
	}
	DOM.videoQueueSelect.selectedIndex = activeQueueIndex;
};

/** Switches the active video to the specified index in the queue. */
const switchVideoInQueue = async (index) => {
	if (index === activeQueueIndex) return;

	if (typeof window.resetVideoViewport === "function") {
		window.resetVideoViewport(player);
	}
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
	window.resetClosedCaptions();
	const isTauri = window.__TAURI__ !== undefined;

	if (isTauri && videoFilePath) {
		const tauriAssetUrl = window.__TAURI__.core.convertFileSrc(videoFilePath);
		player.src = tauriAssetUrl;
		player.preload = "auto";
		toggleVideoPlaceholder(false);
		window.loadSubtitleTrack(videoFilePath);
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

/** Removes the currently active video from the project queue. */
const removeCurrentVideo = async () => {
	if (typeof window.resetVideoViewport === "function") {
		window.resetVideoViewport(player);
	}
	if (videoQueue.length === 0) return;

	const confirmRemove = await asyncConfirm(
		"Are you sure you want to remove this video from the project?",
		"Remove Video",
	);
	if (!confirmRemove) return;

	videoQueue.splice(activeQueueIndex, 1);

	if (videoQueue.length === 0) {
		activeQueueIndex = 0;
		videoFileName = "";
		videoFilePath = "";
		processStartTime = 0;
		processEndTime = 0;
		markers = [];

		player.src = "";
		player.removeAttribute("src");
		toggleVideoPlaceholder(true);
		DOM.videoPlaceholder.textContent = "Load a video to get started";

		renderVideoQueueSelect();
		updateMarkersList();
		updateSliderTicks();
		saveLocalState();
		showToast("Video removed from queue.", "info");
	} else {
		if (activeQueueIndex >= videoQueue.length) {
			activeQueueIndex = videoQueue.length - 1;
		}

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
		window.resetClosedCaptions();
		const isTauri = window.__TAURI__ !== undefined;
		if (isTauri && videoFilePath) {
			const tauriAssetUrl = window.__TAURI__.core.convertFileSrc(videoFilePath);
			player.src = tauriAssetUrl;
			player.preload = "auto";
			toggleVideoPlaceholder(false);
			window.loadSubtitleTrack(videoFilePath);
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
				? `Video switched. Click here to locate video: ${videoFileName}`
				: "Load a video to get started";
			toggleVideoPlaceholder(true);
		}
		updateLoadButtonColor();
		updateSliderTicks();
		saveLocalState();
		showToast(`Switched to: ${currentVideo.videoName}`, "success");
	}
};

window.removeCurrentVideo = removeCurrentVideo;

/** Prompts for a new video name and adds a slot to the queue. */
const addVideoToQueue = async () => {
	const videoName = await asyncPrompt(
		"Enter a name for the new video:",
		`Video ${videoQueue.length + 1}`,
		"New Video",
	);
	if (!videoName) return;
	const duplicate = await asyncConfirm(
		"Would you like to duplicate the current video's data? (Click 'Cancel' to create a blank video slot)",
		"Duplicate Data?",
	);

	saveLocalState();
	const newVideoId =
		videoQueue.length > 0
			? Math.max(...videoQueue.map((v) => v.videoId)) + 1
			: 1;

	const newVideo = duplicate
		? {
				...JSON.parse(JSON.stringify(videoQueue[activeQueueIndex])),
				videoId: newVideoId,
				videoName,
			}
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

/** Opens a file dialog and adds a newly selected video to the queue. */
const addNewVideoToQueue = async () => {
	if (!openDialog) {
		alert("Loading local files requires the desktop app.");
		return;
	}

	const selected = await openDialog({
		multiple: false,
		filters: [
			{ name: "Video Files", extensions: ["mp4", "mkv", "avi", "webm"] },
		],
	});

	if (!selected) return;

	const filePath = typeof selected === "object" ? selected.path : selected;
	if (!filePath) return;

	const extractedFileName = filePath.split(/[/\\]/).pop();

	const newItem = {
		videoId: Date.now(),
		videoName: extractedFileName,
		videoFileName: extractedFileName,
		videoFilePath: filePath,
		processStartTime: 0,
		processEndTime: 0,
		appState: { markers: [] },
	};

	saveLocalState();
	videoQueue.push(newItem);

	renderVideoQueueSelect();
	await switchVideoInQueue(videoQueue.length - 1);
};

/** Renames the current video in the queue based on user input. */
const editVideoInQueue = async () => {
	const currentName = videoQueue[activeQueueIndex].videoName;
	const newName = await asyncPrompt(
		"Rename Video:",
		currentName,
		"Edit Video Name",
	);
	if (!newName || newName.trim() === "") return;

	videoQueue[activeQueueIndex].videoName = newName.trim();
	saveLocalState();
	renderVideoQueueSelect();
	showToast("Video renamed successfully.", "success");
};

/** Rebuilds the DOM list of videos for the left playlist sidebar. */
window.renderSidebarPlaylist = () => {
	const container = document.getElementById("sidebar-queue-list");
	if (!container) return;
	container.innerHTML = "";

	for (const [index, video] of videoQueue.entries()) {
		const div = document.createElement("div");
		div.className =
			"flex items-center justify-between gap-2 p-2.5 rounded mb-1.5 cursor-pointer text-sm transition-colors border select-none";

		const numberPrefix = `${index + 1}. `;
		const fileName = video.videoFileName || "Unknown File";

		const span = document.createElement("span");
		span.className = "truncate flex-1 pointer-events-none";

		if (index === activeQueueIndex) {
			div.classList.add(
				"bg-zinc-200",
				"dark:bg-zinc-800",
				"border-zinc-300",
				"dark:border-zinc-700",
				"text-zinc-900",
				"dark:text-white",
				"font-semibold",
			);
			span.textContent = `▶ ${numberPrefix}${fileName}`;
		} else {
			div.classList.add(
				"bg-zinc-100",
				"dark:bg-zinc-800/40",
				"border-transparent",
				"text-zinc-700",
				"dark:text-zinc-300",
				"hover:bg-zinc-200",
				"dark:hover:bg-zinc-700/60",
			);
			span.textContent = `${numberPrefix}${fileName}`;
		}
		div.appendChild(span);

		// Action wrapper container for reorder buttons
		const actionWrapper = document.createElement("div");
		actionWrapper.className = "flex items-center gap-1.5 flex-shrink-0";

		// Move Up Button
		const moveUpBtn = document.createElement("button");
		moveUpBtn.type = "button";
		moveUpBtn.className =
			"p-1 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer flex items-center justify-center transition-colors";
		moveUpBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
		if (index === 0) {
			moveUpBtn.disabled = true;
		} else {
			moveUpBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				// Swap items
				const temp = videoQueue[index];
				videoQueue[index] = videoQueue[index - 1];
				videoQueue[index - 1] = temp;

				// Adjust activeQueueIndex
				if (activeQueueIndex === index) {
					activeQueueIndex = index - 1;
				} else if (activeQueueIndex === index - 1) {
					activeQueueIndex = index;
				}

				saveLocalState();
				renderVideoQueueSelect();
				window.renderSidebarPlaylist();
			});
		}
		actionWrapper.appendChild(moveUpBtn);

		// Move Down Button
		const moveDownBtn = document.createElement("button");
		moveDownBtn.type = "button";
		moveDownBtn.className =
			"p-1 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer flex items-center justify-center transition-colors";
		moveDownBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
		if (index === videoQueue.length - 1) {
			moveDownBtn.disabled = true;
		} else {
			moveDownBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				// Swap items
				const temp = videoQueue[index];
				videoQueue[index] = videoQueue[index + 1];
				videoQueue[index + 1] = temp;

				// Adjust activeQueueIndex
				if (activeQueueIndex === index) {
					activeQueueIndex = index + 1;
				} else if (activeQueueIndex === index + 1) {
					activeQueueIndex = index;
				}

				saveLocalState();
				renderVideoQueueSelect();
				window.renderSidebarPlaylist();
			});
		}
		actionWrapper.appendChild(moveDownBtn);

		div.appendChild(actionWrapper);

		div.addEventListener("click", async () => {
			await switchVideoInQueue(index);
			window.renderSidebarPlaylist();
		});

		container.appendChild(div);
	}
};

// 5. Central LocalStorage Serialization Triggers

// Helper to transform raw seconds into valid WebVTT time syntax (HH:MM:SS.mmm)
window.formatVttTimestamp = (seconds) => {
	const h = Math.floor(seconds / 3600)
		.toString()
		.padStart(2, "0");
	const m = Math.floor((seconds % 3600) / 60)
		.toString()
		.padStart(2, "0");
	const s = Math.floor(seconds % 60)
		.toString()
		.padStart(2, "0");
	const ms = Math.floor((seconds % 1) * 1000)
		.toString()
		.padStart(3, "0");
	return `${h}:${m}:${s}.${ms}`;
};

window.toggleClosedCaptions = () => {
	// 1. Establish or default your tracking toggle state variable
	if (typeof window.isCcActive === "undefined") {
		window.isCcActive = false;
	}

	// Flip the operational toggle switch
	window.isCcActive = !window.isCcActive;

	const videoElement = player || document.getElementById("my_video");
	const ccToggleBtn = document.getElementById("ccToggleBtn");

	if (!videoElement) return;

	if (window.isCcActive) {
		console.log("[CC System] Turning subtitles ON...");

		// If tracks exist, force them into showing mode
		let trackFound = false;
		for (let i = 0; i < videoElement.textTracks.length; i++) {
			if (videoElement.textTracks[i].label === "Generated Captions") {
				videoElement.textTracks[i].mode = "showing";
				trackFound = true;
			}
		}

		// If no active track is loaded in the DOM container yet, fall back to compiling fresh ones
		if (!trackFound && typeof window.triggerVttGeneration === "function") {
			window.triggerVttGeneration();
			return; // The generator function will handle illuminating the button state
		}

		// Illuminate the toggle button badge with active theme colors
		if (ccToggleBtn) {
			ccToggleBtn.classList.remove("text-zinc-400", "dark:text-zinc-600");
			ccToggleBtn.classList.add("text-yellow-500", "dark:text-yellow-400");
		}
	} else {
		console.log(
			"[CC System] Nuking subtitles from active player memory (ON -> OFF)...",
		);

		// 2. Disable browser level tracks immediately to clear rendering buffers
		for (let i = 0; i < videoElement.textTracks.length; i++) {
			videoElement.textTracks[i].mode = "disabled";
		}

		// 3. Surgically extract all track elements entirely from the DOM tree
		const activeTrackElements = videoElement.querySelectorAll("track");
		activeTrackElements.forEach((trackNode) => {
			trackNode.remove();
			console.log("[CC System] Track node purged from DOM.");
		});

		// 4. Strip out active highlights from the toolbar widget button container
		if (ccToggleBtn) {
			ccToggleBtn.classList.remove("text-yellow-500", "dark:text-yellow-400");
			ccToggleBtn.classList.add("text-zinc-400", "dark:text-zinc-600");
		}

		showToast("Closed captions deactivated", "info");
	}
};

// Main script generator sequence
window.triggerVttGeneration = async () => {
	// Grab current video tracking data from active target queue
	const currentVideo = videoQueue[activeQueueIndex];
	if (!currentVideo?.videoFilePath) {
		showToast("No active video found to generate subtitles for", "error");
		return;
	}

	// Confirm markers data cache is populated (adjust array variable name to match your system state)
	const targetMarkers = typeof markers !== "undefined" ? markers : [];
	if (targetMarkers.length === 0) {
		showToast("Please add at least one marker to compile captions", "error");
		return;
	}

	// Sort chronologically to maintain caption reading order flow
	const sortedMarkers = [...targetMarkers].sort(
		(a, b) => a.startTime - b.startTime,
	);

	// Initialize standard WebVTT syntax header string block
	let vttContent = "WEBVTT\n\n";

	// Loop segments to assemble sequential tracking boxes
	sortedMarkers.forEach((marker, idx) => {
		const startTime = window.formatVttTimestamp(marker.startTime);
		let endTime;

		if (idx < sortedMarkers.length - 1) {
			// End caption text right when the next sequential marker begins
			endTime = window.formatVttTimestamp(sortedMarkers[idx + 1].startTime);
		} else {
			// Terminal marker hold rule: last default screen duration is set to +4 seconds
			endTime = window.formatVttTimestamp(marker.startTime + 4);
		}

		const cueText = marker.name || `Marker Segment ${idx + 1}`;
		vttContent += `${startTime} --> ${endTime}\n${cueText}\n\n`;
	});

	try {
		// Fire string buffer to Rust backend command processor to handle absolute filesystem overwrite execution
		if (window.__TAURI__) {
			await window.__TAURI__.core.invoke("save_vtt_file", {
				videoPath: currentVideo.videoFilePath,
				vttText: vttContent,
			});
			showToast("Closed captions generated and saved successfully!", "success");
		} else {
			console.log("Mock VTT Engine Payload:\n", vttContent);
		}

		// 1. Compute and print absolute VTT destination path
		const vttFilePath = `${currentVideo.videoFilePath.replace(/\.[^/.]+$/, "")}.vtt`;
		console.log("[CC Debug] Target VTT file absolute path:", vttFilePath);

		// 2. Select and verify core video container element
		const videoElement = player || document.getElementById("my_video");
		if (!videoElement) {
			console.error(
				"[CC Debug] CRITICAL: Video element container not found in the DOM!",
			);
			showToast("Video player element missing", "error");
			return;
		}

		// Purge any pre-existing caption tracks to prevent subtitle overlap ghosts
		const oldTrack = videoElement.querySelector(
			"track[label='Generated Captions']",
		);
		if (oldTrack) {
			console.log("[CC Debug] Removing stale caption track node.");
			oldTrack.remove();
		}

		// 3. Build the new track node with explicit asynchronous error catching
		const track = document.createElement("track");
		track.kind = "subtitles";
		track.label = "Generated Captions";
		track.srclang = "en";

		// Hook into the native DOM error event to catch hidden browser protocol rejections
		track.onerror = (e) => {
			console.error(
				"[CC Debug] DOM Track Element failed to load source URL cleanly:",
				track.src,
				e,
			);
			showToast("Browser blocked subtitle resource stream path", "error");
		};

		track.onload = () => {
			console.log(
				"[CC Debug] Success! HTML5 Video Track successfully loaded and parsed WebVTT resource.",
			);
		};

		// Resolve the Tauri asset stream path using multiple validation fallbacks
		let resolvedSrc = "";
		if (window.__TAURI__?.core?.convertFileSrc) {
			resolvedSrc = window.__TAURI__.core.convertFileSrc(vttFilePath);
		} else if (window.__TAURI__?.tauri?.convertFileSrc) {
			resolvedSrc = window.__TAURI__.tauri.convertFileSrc(vttFilePath);
		} else {
			resolvedSrc = `https://asset.localhost/${encodeURIComponent(vttFilePath)}`;
		}

		console.log(
			"[CC Debug] Tauri convertFileSrc converted protocol path to:",
			resolvedSrc,
		);
		track.src = resolvedSrc;
		track.default = true;

		// Append track to the live viewport container stream
		videoElement.appendChild(track);

		// 4. Force browser track state selection layout sync
		setTimeout(() => {
			console.log(
				"[CC Debug] Syncing player textTracks list states. Total tracks available:",
				videoElement.textTracks.length,
			);
			let syncSuccess = false;
			for (let i = 0; i < videoElement.textTracks.length; i++) {
				const currentTrack = videoElement.textTracks[i];
				if (currentTrack.label === "Generated Captions") {
					currentTrack.mode = "showing";
					syncSuccess = true;
					console.log(
						"[CC Debug] Successfully forced 'Generated Captions' track mode to 'showing'.",
					);
				} else {
					currentTrack.mode = "disabled";
				}
			}
			if (!syncSuccess) {
				console.warn(
					"[CC Debug] Warning: Could not find 'Generated Captions' inside the active video textTracks array.",
				);
			}
		}, 100);

		// 5. Illuminate your player's CC toggle switch icon badge
		const ccToggleBtn = document.getElementById("ccToggleBtn");
		if (ccToggleBtn) {
			ccToggleBtn.removeAttribute("disabled");
			ccToggleBtn.classList.remove("text-zinc-400", "dark:text-zinc-600");
			ccToggleBtn.classList.add("text-yellow-500", "dark:text-yellow-400");
			console.log("[CC Debug] Visual CC dashboard button illuminated.");
			window.captionsVisible = true;
			window.isCcActive = true;
		}
	} catch (error) {
		console.error("VTT Export Failed:", error);
		showToast("Failed to write subtitle track file to disk", "error");
	}
};
