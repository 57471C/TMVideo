let columnChart = null;
let ganttChart = null;
let pieCharts = [];
let compareCharts = [];
let chartMode = "column";

const LABOUR_COLORS = [
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f59e0b", // Amber
  "#14b8a6", // Teal
  "#10b981", // Emerald
  "#6366f1", // Indigo
  "#f43f5e", // Rose
  "#84cc16", // Lime
];

const getLabourColor = (code) => {
  if (!code) return "#a1a1aa"; // Neutral gray for Unassigned
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % LABOUR_COLORS.length;
  return LABOUR_COLORS[index];
};

const getTaskLabourCode = (task) => {
  if (task && task.labourTags && task.labourTags.length > 0) {
    return task.labourTags[0];
  }
  return null;
};

const toggleChartMode = () => {
  chartMode = chartMode === "column" ? "gantt" : "column";
  if (typeof updateTaskList === "function") updateTaskList();
  drawTable();
};

const toggleGroupingMode = () => {
  groupingMode = groupingMode === "lean" ? "labour" : "lean";
  if (typeof updateTaskList === "function") updateTaskList();
  drawTable();
};

const updateChartThemes = (isDark) => {
  const mode = isDark ? "dark" : "light";
  if (columnChart) columnChart.updateOptions({ theme: { mode: mode } });
  if (ganttChart) ganttChart.updateOptions({ theme: { mode: mode } });
  pieCharts.forEach((c) => {
    c.updateOptions({ theme: { mode: mode } });
  });
  compareCharts.forEach((c) => {
    c.updateOptions({ theme: { mode: mode } });
  });
};

const openCompareDashboard = () => {
  saveLocalState();

  const categories = [];
  const vaData = [];
  const nvaData = [];
  const wData = [];
  const unitsData = [];
  const costData = [];

  for (const trial of trials) {
    categories.push(trial.trialName);

    let va = 0;
    let nva = 0;
    let w = 0;

    const ops = trial.appState?.operations || [];
    for (const op of ops) {
      for (const task of op.tasks || []) {
        if (task.status === "VA") va += task.duration;
        else if (task.status === "NVA") nva += task.duration;
        else if (task.status === "W") w += task.duration;
      }
    }

    vaData.push(va);
    nvaData.push(nva);
    wData.push(w);

    const totalMs = va + nva + w;

    // Calculate Units per Shift (Shift Length * Efficiency / Total Task Time)
    const shiftMs = (trial.costingConfig?.shiftLength || 480) * 60 * 1000;
    const efficiency = (trial.costingConfig?.targetEfficiency || 100) / 100;
    const effectiveMs = shiftMs * efficiency;

    const cycleUnits = trial.costingConfig?.unitsPerCycle || 1;
    const units = totalMs > 0 ? Math.floor((effectiveMs / totalMs) * cycleUnits) : 0;
    unitsData.push(units);

    const rate = trial.costingConfig?.hourlyRate || 0;
    // Cost = (Total time in hours) * Hourly Rate
    const cycleCost = (totalMs / 3600000) * rate;
    const costPerUnit = cycleCost / cycleUnits;
    costData.push(costPerUnit);
  }

  DOM.compareModal.showModal();

  const isDark = document.documentElement.classList.contains("dark");

  compareCharts.forEach((c) => {
    c.destroy();
  });
  compareCharts = [];

  setTimeout(() => {
    const vaNvaChart = new ApexCharts(document.getElementById("compareVaNvaChart"), {
      series: [
        { name: "Value-Add (VA)", data: vaData, color: "#10b981" },
        { name: "Non-Value-Add (NVA)", data: nvaData, color: "#f59e0b" },
        { name: "Waste (W)", data: wData, color: "#f43f5e" },
      ],
      chart: { type: "bar", height: 360, stacked: true, background: "transparent", toolbar: { show: false } },
      theme: { mode: isDark ? "dark" : "light" },
      xaxis: { categories: categories },
      yaxis: {
        title: { text: "Time" },
        labels: { formatter: (val) => formatDurationValue(val) },
      },
      title: { text: "Value Analysis Breakdown" },
      dataLabels: { enabled: false },
      tooltip: { y: { formatter: (val) => formatDurationValue(val) } },
    });
    vaNvaChart.render();
    compareCharts.push(vaNvaChart);

    const unitsChart = new ApexCharts(document.getElementById("compareUnitsChart"), {
      series: [{ name: "Units", data: unitsData, color: "#3b82f6" }],
      chart: { type: "bar", height: 360, background: "transparent", toolbar: { show: false } },
      theme: { mode: isDark ? "dark" : "light" },
      xaxis: { categories: categories },
      yaxis: { title: { text: "Units" } },
      title: { text: "Estimated Units per Shift" },
      dataLabels: { enabled: true },
    });
    unitsChart.render();
    compareCharts.push(unitsChart);

    const costChart = new ApexCharts(document.getElementById("compareCostChart"), {
      series: [{ name: "Cost", data: costData, color: "#8b5cf6" }],
      chart: { type: "bar", height: 360, background: "transparent", toolbar: { show: false } },
      theme: { mode: isDark ? "dark" : "light" },
      xaxis: { categories: categories },
      yaxis: {
        title: { text: "Cost ($)" },
        labels: { formatter: (val) => `$${val.toFixed(2)}` },
      },
      title: { text: "Estimated Labor Cost per Unit" },
      dataLabels: {
        enabled: true,
        formatter: (val) => `$${val.toFixed(4)}`,
      },
      tooltip: { y: { formatter: (val) => `$${val.toFixed(4)}` } },
    });
    costChart.render();
    compareCharts.push(costChart);
  }, 10);
};

const drawTable = () => {
  try {
    if (!DOM.chartContainer || !DOM.pieChartContainer) {
      throw new Error("Chart container elements not found");
    }

    if (columnChart) {
      columnChart.destroy();
      columnChart = null;
    }
    if (ganttChart) {
      ganttChart.destroy();
      ganttChart = null;
    }
    pieCharts.forEach((c) => {
      c.destroy();
    });
    pieCharts = [];

    if (operations.length === 0) {
      DOM.chartContainer.innerHTML = "";
      DOM.ganttChartContainer.innerHTML = "";
      DOM.pieChartContainer.innerHTML = "";
      return;
    }
    if (taktTime === null || taktTime <= 0) {
      return;
    }
    if (typeof ApexCharts === "undefined") {
      return;
    }
    const isDarkMode = document.documentElement.classList.contains("dark");

    const opNames = operations.map((o) => o.name);

    if (chartMode === "column") {
      DOM.chartContainer.style.display = "block";
      DOM.ganttChartContainer.style.display = "none";

      const series = [];
      for (let j = 0; j < operations.length; j += 1) {
        const op = operations[j];
        for (let i = 0; i < op.tasks.length; i += 1) {
          const task = op.tasks[i];
          const data = new Array(operations.length).fill(0);
          data[j] = task.duration;

          let color = "#10b981";
          let displayName = task.name || `Task ${i + 1}`;
          if (groupingMode === "lean") {
            if (task.status === "NVA") color = "#f59e0b";
            else if (task.status === "W") color = "#f43f5e";
          } else {
            const code = getTaskLabourCode(task);
            color = getLabourColor(code);
            displayName += ` (${code || "Unassigned"})`;
          }

          series.push({
            name: `${op.name}-${i}-${displayName}`, // Make name unique to prevent ApexCharts stacking bug
            taskName: task.name || `Task ${i + 1}`,
            taskStatus: task.status,
            taskLabour: getTaskLabourCode(task),
            data: data,
            color: color,
          });
        }
      }

      const maxStackHeight = Math.max(0, ...operations.map(op =>
        (op.tasks || []).reduce((sum, t) => sum + (t.duration || 0), 0)
      ));

      columnChart = new ApexCharts(DOM.chartContainer, {
        series: series,
        chart: { type: "bar", height: 400, stacked: true, background: "transparent", toolbar: { show: false } },
        theme: { mode: isDarkMode ? "dark" : "light" },
        plotOptions: {
          bar: {
            columnWidth: "50%",
            dataLabels: {
              total: {
                enabled: true,
                style: {
                  fontSize: "12px",
                  fontWeight: 900,
                  color: isDarkMode ? "#ffffff" : "#000000",
                },
                formatter: (val) => formatDurationValue(val),
              },
            },
          },
        },
        xaxis: { categories: opNames },
        yaxis: {
          title: { text: "Duration" },
          labels: { formatter: (val) => formatDurationValue(val) },
          max: maxStackHeight > 0 ? maxStackHeight * 1.05 : undefined,
        },
        title: { text: "Operation Task Durations" },
        legend: { show: false },
        dataLabels: {
          enabled: true,
          formatter: (val) => (val > 0 ? formatDurationValue(val) : ""),
          style: {
            fontSize: "6px",
            fontWeight: "normal",
          },
        },
        tooltip: {
          custom: ({ series, seriesIndex, dataPointIndex, w }) => {
            const s = w.config.series[seriesIndex];
            const val = s.data[dataPointIndex];
            if (!val || val <= 0) return "";

            const taskName = s.taskName || s.name;
            const opName = w.globals.labels[dataPointIndex];

            let extraInfo = "";
            if (groupingMode === "lean") {
              extraInfo = `<b>Status:</b> ${s.taskStatus || "VA"}`;
            } else {
              extraInfo = `<b>Labour:</b> ${escapeHTML(s.taskLabour || "Unassigned")}`;
            }

            return `<div class="p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm rounded">
              <b>Operation:</b> ${escapeHTML(opName)}<br/>
              <b>Task:</b> ${escapeHTML(taskName)}<br/>
              ${extraInfo}<br/>
              <b>Duration:</b> ${formatDurationValue(val)}
            </div>`;
          },
        },
        annotations: {
          yaxis: [
            {
              y: taktTime,
              borderColor: "#0000FF",
              label: {
                text: `Takt: ${formatDurationValue(taktTime)}`,
                style: { color: "#fff", background: "#0000FF" },
              },
            },
          ],
        },
      });
      columnChart.render();
    } else {
      DOM.chartContainer.style.display = "none";
      DOM.ganttChartContainer.style.display = "block";

      const ganttData = [];
      for (let i = 0; i < operations.length; i += 1) {
        const op = operations[i];
        let currentStart = op.startTime * 1000;
        for (let j = 0; j < op.tasks.length; j += 1) {
          const task = op.tasks[j];
          let color = "#10b981";
          if (groupingMode === "lean") {
            color = task.status === "VA" ? "#10b981" : task.status === "NVA" ? "#f59e0b" : "#f43f5e";
          } else {
            color = getLabourColor(getTaskLabourCode(task));
          }
          ganttData.push({
            x: op.name,
            y: [currentStart, currentStart + task.duration],
            fillColor: color,
            taskName: task.name,
            status: task.status,
            labour: getTaskLabourCode(task),
          });
          currentStart += task.duration;
        }
      }

      ganttChart = new ApexCharts(DOM.ganttChartContainer, {
        series: [{ data: ganttData }],
        chart: {
          type: "rangeBar",
          height: Math.max(300, operations.length * 80),
          background: "transparent",
          toolbar: { show: false },
          zoom: {
            enabled: true,
            type: "x",
          },
          events: {
            beforeZoom: (chartContext, { xaxis }) => {
              const boundaryMin = processStartTime * 1000;
              const boundaryMax = processEndTime > processStartTime ? processEndTime * 1000 : processStartTime * 1000;

              let newMin = xaxis.min;
              let newMax = xaxis.max;

              // 1. Prevent zooming out beyond the defined process start/end times
              if (newMin <= boundaryMin && newMax >= boundaryMax) {
                if (chartContext.w.globals.minX <= boundaryMin && chartContext.w.globals.maxX >= boundaryMax) {
                  return { xaxis: { min: chartContext.w.globals.minX, max: chartContext.w.globals.maxX } };
                }
                return { xaxis: { min: boundaryMin, max: boundaryMax } };
              }

              if (newMin < boundaryMin) newMin = boundaryMin;
              if (newMax > boundaryMax) newMax = boundaryMax;

              // 2. Prevent zooming in too much (less than 100ms range)
              const minZoomRange = 100;
              if (newMax - newMin < minZoomRange) {
                // To prevent the zoom, we return the chart's current range
                return { xaxis: { min: chartContext.w.globals.minX, max: chartContext.w.globals.maxX } };
              }

              return {
                xaxis: { min: newMin, max: newMax },
              };
            },
          },
        },
        theme: { mode: isDarkMode ? "dark" : "light" },
        plotOptions: {
          bar: { horizontal: true, rangeBarGroupRows: true },
        },
        xaxis: {
          type: "datetime",
          min: processStartTime * 1000,
          max: processEndTime > processStartTime ? processEndTime * 1000 : processStartTime * 1000,
          labels: {
            formatter: (val) => formatDurationValue(val),
          },
        },
        title: { text: "Task Timeline (Gantt)" },
        tooltip: {
          custom: ({ seriesIndex, dataPointIndex, w }) => {
            const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
            const duration = data.y[1] - data.y[0];
            const extraInfo = groupingMode === "lean"
              ? `<b>Status:</b> ${data.status}`
              : `<b>Labour:</b> ${escapeHTML(data.labour || "Unassigned")}`;
            return `<div class="p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm rounded">
              <b>Operation:</b> ${escapeHTML(data.x)}<br/>
              <b>Task:</b> ${escapeHTML(data.taskName)}<br/>
              ${extraInfo}<br/>
              <b>Duration:</b> ${formatDurationValue(duration)}
            </div>`;
          },
        },
      });
      ganttChart.render();
    }

    DOM.pieChartContainer.innerHTML = "";
    for (let i = 0; i < operations.length; i += 1) {
      const op = operations[i];
      
      let pieData = [];
      if (groupingMode === "lean") {
        const statusDurations = { VA: 0, NVA: 0, W: 0 };
        for (let j = 0; j < op.tasks.length; j += 1) {
          if (op.tasks[j]?.status) {
            statusDurations[op.tasks[j].status.toUpperCase()] += op.tasks[j].duration;
          }
        }
        pieData = [
          { name: "VA", y: statusDurations.VA, color: "#10b981" },
          { name: "NVA", y: statusDurations.NVA, color: "#f59e0b" },
          { name: "W", y: statusDurations.W, color: "#f43f5e" },
        ].filter((item) => item.y > 0);
      } else {
        const labourDurations = {};
        for (let j = 0; j < op.tasks.length; j += 1) {
          const task = op.tasks[j];
          const code = getTaskLabourCode(task) || "Unassigned";
          labourDurations[code] = (labourDurations[code] || 0) + task.duration;
        }
        pieData = Object.entries(labourDurations).map(([code, duration]) => ({
          name: code,
          y: duration,
          color: getLabourColor(code === "Unassigned" ? null : code),
        })).filter((item) => item.y > 0);
      }

      if (pieData.length === 0) continue;

      const pieDiv = document.createElement("div");
      pieDiv.id = `pieChart${i}`;
      pieDiv.className = "pieChart w-45 h-37.5 m-2 inline-block";
      DOM.pieChartContainer.appendChild(pieDiv);

      const pie = new ApexCharts(pieDiv, {
        series: pieData.map((d) => d.y),
        labels: pieData.map((d) => d.name),
        colors: pieData.map((d) => d.color),
        chart: { type: "pie", height: 150, width: 180, background: "transparent" },
        legend: { show: false },
        stroke: { width: 1 },
        theme: { mode: isDarkMode ? "dark" : "light" },
        title: { text: `${op.name} Duration` },
        tooltip: {
          y: { formatter: (val) => formatDurationValue(val) },
        },
        dataLabels: {
          formatter: (val, opts) => {
            return `${opts.w.globals.labels[opts.seriesIndex]}: ${val.toFixed(1)}%`;
          },
        },
      });
      pie.render();
      pieCharts.push(pie);
    }
  } catch (error) {
    toConsole("drawTable error", error.message, debuggin);
    alert("Failed to render charts. Please check the console for details.");
  }
};
