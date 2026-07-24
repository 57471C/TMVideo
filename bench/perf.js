const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const appCode = fs.readFileSync(path.join(__dirname, "../ui/app.js"), "utf8");

// Set up JSDOM
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="sidebar-queue-list"></div></body></html>`, { runScripts: "dangerously" });
const { window } = dom;

// Inject globals into the JSDOM window directly before eval
window.videoQueue = Array(1000).fill().map((_, i) => ({ videoFileName: `Video_${i}.mp4` }));
window.activeQueueIndex = 0;
window.saveLocalState = () => {};
window.renderVideoQueueSelect = () => {};
window.switchVideoInQueue = async () => {};

// Evaluate code within the JSDOM context so it finds its globals
const scriptEl = window.document.createElement("script");
scriptEl.textContent = appCode;
window.document.body.appendChild(scriptEl);

if (!window.renderSidebarPlaylist) {
  console.log("Failed to load renderSidebarPlaylist");
  process.exit(1);
}

const ITERATIONS = 10;
const start = performance.now();

for (let i = 0; i < ITERATIONS; i++) {
  window.renderSidebarPlaylist();
}

const end = performance.now();
console.log(`Time taken: ${(end - start).toFixed(2)}ms for ${ITERATIONS} iterations of ${window.videoQueue.length} items`);
