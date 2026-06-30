// --- CRITICAL HARDWARE-LEVEL INTERCEPTOR & DE-DUPLICATED TRANSCODER GATE ---
(() => {
	console.log(
		"[Failsafe Proxy] Instantiating global media asset pipeline hooks at early boot...",
	);

	const originalSrcDescriptor = Object.getOwnPropertyDescriptor(
		HTMLMediaElement.prototype,
		"src",
	);
	const originalSetAttribute = Element.prototype.setAttribute;

	if (!originalSrcDescriptor) {
		console.error(
			"[Failsafe Proxy] Critical: Cannot map property descriptors on HTMLMediaElement.",
		);
		return;
	}

	let insideRedirectLoop = false;
	window.activeOptimizations = window.activeOptimizations || new Set();
	let optimizationViewTimerTimeoutRef = null;

	function interceptAndOptimizeMedia(elementInstance, incomingSourceUrl) {
		if (
			insideRedirectLoop ||
			!incomingSourceUrl ||
			typeof incomingSourceUrl !== "string"
		) {
			return false;
		}

		// Un-wrap path strings if they have already been formatted into secure local stream server protocols
		let absoluteDiskPath = incomingSourceUrl;
		if (incomingSourceUrl.startsWith("http://asset.localhost/")) {
			absoluteDiskPath = decodeURIComponent(
				incomingSourceUrl.replace("http://asset.localhost/", ""),
			);
		} else if (incomingSourceUrl.startsWith("https://asset.localhost/")) {
			absoluteDiskPath = decodeURIComponent(
				incomingSourceUrl.replace("https://asset.localhost/", ""),
			);
		}

		// Intercept native Windows absolute drive definitions or backslash structures
		if (
			absoluteDiskPath.match(/^[a-zA-Z]:\\/) ||
			absoluteDiskPath.includes("\\") ||
			absoluteDiskPath.includes("/")
		) {
			// Concurrency Gate: Drop duplicate load assertions if a background encode job is already processing
			if (window.activeOptimizations.has(absoluteDiskPath)) {
				console.log(
					`[Failsafe Proxy] Deduplicating assignment request. Task already running for path: "${absoluteDiskPath}"`,
				);
				return true;
			}

			console.warn(
				`%c[Failsafe Proxy] Caught active media source assignment: "${absoluteDiskPath}"`,
				"background: #7FDBFF; color: #001f3f; font-weight: bold; padding: 2px;",
			);
			window.activeOptimizations.add(absoluteDiskPath);

			const optimizationOverlayNode =
				document.getElementById("optimizingOverlay");
			if (optimizationOverlayNode) {
				// Clear any existing active timing queues
				if (optimizationViewTimerTimeoutRef)
					clearTimeout(optimizationViewTimerTimeoutRef);

				// Delay showing the loading UI spinner by 250ms to allow standard files to load instantly and silently
				optimizationViewTimerTimeoutRef = setTimeout(() => {
					optimizationOverlayNode.classList.remove("hidden");
					optimizationOverlayNode.classList.add("opacity-100", "flex");
					const textLabel = optimizationOverlayNode.querySelector("p");
					if (textLabel) {
						textLabel.textContent =
							"Optimizing high-efficiency tracking assets... This panel closes automatically when timeline canvas buffers finalize.";
					}
				}, 250);
			}

			// 1. SAFELY RESOLVE THE CORE TAURI INVOKE METHOD PATHWAYS
			const invokeFn =
				window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;

			if (!invokeFn) {
				console.error(
					"[Failsafe Proxy] Environment mismatch: Tauri invocation endpoints are not accessible.",
				);
				cleanupFailsafeView(absoluteDiskPath, incomingSourceUrl);
				return false;
			}

			// 2. DISPATCH PATH TO BACKEND ASYNC WORKER CHANNELS
			invokeFn("verify_and_prepare_video", { videoPath: absoluteDiskPath })
				.then((resolvedProxyPath) => {
					const cleanProxyPath = resolvedProxyPath.replace(/^\\\\?\\/, "");
					console.log(
						"[Failsafe Proxy] Target successfully optimized/verified:",
						cleanProxyPath,
					);

					// Translate absolute cache files safely into authenticated browser streaming URLs
					const convertFn =
						window.__TAURI__?.core?.convertFileSrc ||
						window.__TAURI__?.tauri?.convertFileSrc;
					const finalizedStreamUrl = convertFn
						? convertFn(cleanProxyPath)
						: cleanProxyPath;

					console.log(
						"[Failsafe Proxy] Pushing safe stream format URL down to video tag layer:",
						finalizedStreamUrl,
					);

					insideRedirectLoop = true;
					originalSrcDescriptor.set.call(elementInstance, finalizedStreamUrl);
					insideRedirectLoop = false;

					elementInstance.load();
				})
				.catch((err) => {
					console.error(
						"[Failsafe Proxy] Processing channel encountered a fault. Reverting to baseline asset stream path:",
						err,
					);
					insideRedirectLoop = true;
					originalSrcDescriptor.set.call(elementInstance, incomingSourceUrl);
					insideRedirectLoop = false;
				})
				.finally(() => {
					cleanupFailsafeView(absoluteDiskPath);
				});

			return true; // Blocks raw un-optimized HEVC streams from ever directly hitting and locking up WebView2 decoders
		}
		return false;
	}

	// Shared memory clearance routine to guarantee the overlay modal can never trap the user view state again
	function cleanupFailsafeView(diskPathKey, _directFallbackUrl = null) {
		window.activeOptimizations.delete(diskPathKey);
		if (optimizationViewTimerTimeoutRef) {
			clearTimeout(optimizationViewTimerTimeoutRef);
			optimizationViewTimerTimeoutRef = null;
		}

		const optimizationOverlayNode =
			document.getElementById("optimizingOverlay");
		if (optimizationOverlayNode) {
			optimizationOverlayNode.classList.remove("opacity-100");
			setTimeout(() => {
				optimizationOverlayNode.classList.add("hidden");
				optimizationOverlayNode.classList.remove("flex");
			}, 300);
		}
	}

	// Intercept standard property references (.src = ...)
	Object.defineProperty(HTMLMediaElement.prototype, "src", {
		set: function (assignedValue) {
			const isHijacked = interceptAndOptimizeMedia(this, assignedValue);
			if (!isHijacked) {
				originalSrcDescriptor.set.call(this, assignedValue);
			}
		},
		get: function () {
			return originalSrcDescriptor.get.call(this);
		},
		configurable: true,
		enumerable: true,
	});

	// Intercept HTML attribute adjustments (.setAttribute('src', ...))
	Element.prototype.setAttribute = function (attributeName, attributeValue) {
		if (
			attributeName.toLowerCase() === "src" &&
			this instanceof HTMLMediaElement
		) {
			const isHijacked = interceptAndOptimizeMedia(this, attributeValue);
			if (isHijacked) return;
		}
		return originalSetAttribute.call(this, attributeName, attributeValue);
	};

	console.log(
		"[Failsafe Proxy] Early boot prototype interception guards armed successfully.",
	);
})();

const debounce = (func, wait) => {
	let timeout;
	return (...args) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait);
	};
};

const escapeHTML = (str) => {
	if (typeof str !== "string") return str;
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
};

const sanitizeFilename = (name) => {
	if (typeof name !== "string") return "";
	// biome-ignore lint/suspicious/noControlCharactersInRegex: Needed for robust filename sanitization
	return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
};

const toConsole = (message, value, debuggin = 1) => {
	if (debuggin === 1) {
		console.log(`${message}:`, value);

		// If the message contains an error or failure signature, force a stack trace map
		if (
			typeof message === "string" &&
			(message.toLowerCase().includes("error") ||
				message.toLowerCase().includes("fail"))
		) {
			console.warn(
				`%c[Trace Anchor] Unmasking true source for block: "${message}"`,
				"color: #ff0044; font-weight: bold;",
			);
			console.trace(); // Prints the absolute file path and precise line number that invoked this log
		}
	}
};

const parseTimeStr = (input) => {
	const parts = input.replace(".", ":").split(":");
	if (parts.length < 3 || parts.length > 4) {
		return null;
	}

	let hours = 0,
		minutes,
		seconds,
		milliseconds;
	if (parts.length === 4) {
		hours = Number.parseInt(parts[0], 10);
		minutes = Number.parseInt(parts[1], 10);
		seconds = Number.parseInt(parts[2], 10);
		milliseconds = Number.parseInt(parts[3], 10) * 10;
	} else {
		minutes = Number.parseInt(parts[0], 10);
		seconds = Number.parseInt(parts[1], 10);
		milliseconds = Number.parseInt(parts[2], 10) * 10;
	}

	if (
		Number.isNaN(hours) ||
		Number.isNaN(minutes) ||
		Number.isNaN(seconds) ||
		Number.isNaN(milliseconds) ||
		minutes >= 60 ||
		seconds >= 60 ||
		milliseconds >= 1000
	) {
		return null;
	}
	return hours * 3600000 + minutes * 60000 + seconds * 1000 + milliseconds;
};

const parseTaktTime = parseTimeStr;

const parseTimeFromHHMMSSMS = (input) => {
	const ms = parseTimeStr(input);
	return ms !== null ? ms / 1000 : null;
};

const formatDuration = (ms) => {
	if (ms === undefined || ms === null || Number.isNaN(ms)) return "00:00:00.00";
	const isNeg = ms < 0;
	const absMs = Math.abs(ms);
	const hours = Math.floor(absMs / 3600000);
	const minutes = Math.floor((absMs % 3600000) / 60000);
	const seconds = Math.floor((absMs % 60000) / 1000);
	const milliseconds = Math.floor((absMs % 1000) / 10);
	const sign = isNeg ? "-" : "";
	return `${sign}${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}`;
};

const formatTaktTime = formatDuration;

const formatTimeToHHMMSSMS = (seconds) =>
	formatDuration(seconds ? seconds * 1000 : 0);

const formatDecimalMinutes = (ms) => {
	if (ms === undefined || ms === null || Number.isNaN(ms)) return "0.00";
	const minutes = ms / (60 * 1000);
	return minutes.toFixed(2);
};

const formatDurationValue = (val) => {
	if (durationMode === "hhmmssms") return formatDuration(val);
	if (durationMode === "ms") return `${val.toFixed(0)} ms`;
	return `${formatDecimalMinutes(val)} min`;
};

if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		parseTimeStr,
		parseTaktTime,
		parseTimeFromHHMMSSMS,
		formatDuration,
		formatTaktTime,
		formatTimeToHHMMSSMS,
		formatDecimalMinutes,
		formatDurationValue,
		debounce
	};
}
