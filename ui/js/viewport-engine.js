/*
 * Viewport Scaling and Panning Engine Module for TMVideo
 * Manages cursor-anchored scroll zooming and right-click panning.
 */

let videoScale = 1.0;
let videoPanX = 0;
let videoPanY = 0;
let isPanningVideo = false;
let startMouseX = 0;
let startMouseY = 0;

function syncFromGlobals() {
	videoScale = zoomLevel || 1.0;
	videoPanX = (translateX || 0) * videoScale;
	videoPanY = (translateY || 0) * videoScale;
}

function syncToGlobals() {
	zoomLevel = videoScale;
	translateX = videoScale > 0 ? videoPanX / videoScale : 0;
	translateY = videoScale > 0 ? videoPanY / videoScale : 0;
}

function updateViewportTransform(video) {
	if (!video) return;
	const scale = window.zoomLevel || 1.0;
	const tX = window.translateX || 0;
	const tY = window.translateY || 0;

	videoScale = scale;
	videoPanX = tX;
	videoPanY = tY;

	if (scale <= 1.0) {
		zoomLevel = 1.0;
		translateX = 0;
		translateY = 0;
		videoScale = 1.0;
		videoPanX = 0;
		videoPanY = 0;
		video.style.transform = "none";
	} else {
		video.style.transformOrigin = "0px 0px";
		video.style.transform = `translate(${tX}px, ${tY}px) scale(${scale})`;
	}
}

window.getNormalizedVideoCoordinates = (screenX, screenY, videoRect) => ({
	x: (screenX - videoRect.left - translateX) / zoomLevel,
	y: (screenY - videoRect.top - translateY) / zoomLevel,
});

window.initializeVideoViewportZoomPan = (videoElement, containerElement) => {
	if (!videoElement || !containerElement) return;

	// Intercept scroll event for zooming on containerElement
	containerElement.addEventListener(
		"wheel",
		(event) => {
			event.preventDefault();

			const containerRect = containerElement.getBoundingClientRect();
			const mouseX = event.clientX - containerRect.left;
			const mouseY = event.clientY - containerRect.top;

			const oldZoom = window.zoomLevel || 1.0;
			const oldX = window.translateX || 0;
			const oldY = window.translateY || 0;

			let targetZoom = oldZoom;
			if (event.deltaY < 0) {
				targetZoom += 0.04;
			} else {
				targetZoom -= 0.04;
			}

			// Clamp zoom level
			targetZoom = Math.min(15.0, Math.max(1.0, targetZoom));

			const scaleRatio = targetZoom / oldZoom;
			window.zoomLevel = targetZoom;
			window.translateX = mouseX - (mouseX - oldX) * scaleRatio;
			window.translateY = mouseY - (mouseY - oldY) * scaleRatio;

			updateViewportTransform(videoElement);
		},
		{ passive: false },
	);

	containerElement.addEventListener("mousedown", (event) => {
		if (event.button === 2) {
			event.preventDefault();
			event.stopPropagation();
			translateX = window.translateX || 0;
			translateY = window.translateY || 0;
			isPanningVideo = true;
			startMouseX = event.clientX;
			startMouseY = event.clientY;
			videoElement.style.cursor = "grabbing";
		}
	});

	// Block context menu inside the container
	containerElement.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		e.stopPropagation();
	});

	containerElement.addEventListener("mousemove", (event) => {
		if (isPanningVideo) {
			const rawDeltaX = event.clientX - startMouseX;
			const rawDeltaY = event.clientY - startMouseY;

			translateX += rawDeltaX;
			translateY += rawDeltaY;

			window.translateX = translateX;
			window.translateY = translateY;

			startMouseX = event.clientX;
			startMouseY = event.clientY;

			updateViewportTransform(videoElement);
		}
	});

	const stopPanning = () => {
		if (isPanningVideo) {
			isPanningVideo = false;
			videoElement.style.cursor = "default";
		}
	};

	containerElement.addEventListener("mouseup", stopPanning);
	containerElement.addEventListener("mouseleave", stopPanning);
};

window.resetVideoViewport = (video) => {
	videoScale = 1.0;
	videoPanX = 0;
	videoPanY = 0;
	zoomLevel = 1.0;
	translateX = 0;
	translateY = 0;
	if (video) {
		video.style.transform = "none";
	}
};

window.viewportState = {
	syncFromGlobals: syncFromGlobals,
	syncToGlobals: syncToGlobals,
};
window.updateViewportTransform = updateViewportTransform;
