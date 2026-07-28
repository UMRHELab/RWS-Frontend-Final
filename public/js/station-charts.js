// Station pages: Chart.js visualization
// Creates line charts for each station metric.
// station-data.js updates these charts with live sensor readings.
// cssVar() (used below) is defined in footer.js, which loads first on every page.

// Chart.js plugin that draws an average reference line on each chart
const avgBaselinePlugin = {
    id: 'avgBaseline',
    afterDatasetsDraw(chart) {
        let data = [];
        if (chart.data.datasets[0]) data = chart.data.datasets[0].data;
        if (!data.length) return;

        // Calculate average value from visible chart data
        let sum = 0;
        for (const v of data) {
            sum += v;
        }
        const avg = sum / data.length;

        const ctx = chart.ctx;
        const left = chart.chartArea.left;
        const right = chart.chartArea.right;
        const y = chart.scales.y;

        const yPos = y.getPixelForValue(avg);
        // Skip drawing if average is outside chart area
        if (yPos < chart.chartArea.top || yPos > chart.chartArea.bottom) {
            return;
        }

        // Draw dashed average line
        ctx.save();
        ctx.strokeStyle = cssVar('--chart-avg-line-color');
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(left, yPos);
        ctx.lineTo(right, yPos);
        ctx.stroke();

        // Add average label next to the line
        let yOffset = -5;
        if (yPos - chart.chartArea.top < 15) {
            yOffset = 12;
        }

        let decimals = 2;
        if (avg > 10) decimals = 1;

        ctx.fillStyle = cssVar('--chart-avg-label-color');
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('AVG ' + avg.toFixed(decimals), right - 6, yPos + yOffset);
        ctx.restore();
    }
};

// Chart.js calls these to decide how the x-axis ticks look. They're kept as
// separate named functions (instead of writing them inline) just so this
// file reads top-to-bottom instead of nesting logic inside the chart config.

// Highlight the newest reading's tick in a different color
function tickColor(ctx) {
    const isLast = ctx.tick.value === ctx.scale.getLabels().length - 1;
    if (isLast) return cssVar('--chart-tick-color-active');
    return cssVar('--chart-tick-color');
}
// Make the newest reading's tick label bold and slightly bigger
function tickFont(ctx) {
    const isLast = ctx.tick.value === ctx.scale.getLabels().length - 1;
    if (isLast) return { size: 11, weight: 'bold' };
    return { size: 9 };
}
// Label the latest reading as "Now" instead of just its timestamp
// Chart.js calls this with `this` set to the axis, so it can't be an arrow function
function tickLabelCallback(value, index) {
    const isLast = index === this.getLabels().length - 1;
    const label = this.getLabelForValue(value);
    if (isLast) return 'Now · ' + label;
    return label;
}
// Keep the newest timestamp visible even when Chart.js would otherwise skip it
function keepLastTickVisible(axis) {
    const lastIndex = axis.getLabels().length - 1;
    if (lastIndex < 0) return;

    let hasLastTick = false;
    for (const t of axis.ticks) {
        if (t.value === lastIndex) {
            hasLastTick = true;
            break;
        }
    }
    if (!hasLastTick) {
        axis.ticks.push({ value: lastIndex });
    }
}

// Create a line chart for one station metric
// Stores the Chart.js instance so live-data updates can add readings later.
function buildChart(key, m) {
    const ctx = document.getElementById(m.canvas);
    if (!ctx) return;

    // Provide chart description for screen readers
    ctx.setAttribute('role', 'img');
    ctx.setAttribute('aria-label', 'Line chart of recent ' + m.label + ' readings');

    const color = cssVar(m.color);
    instances[key] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: color,
                backgroundColor: color + '14',
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 0,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            layout: {
                padding: {
                    top: 12,
                    bottom: 4
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                // Time labels
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 6,
                        maxRotation: 0,
                        color: tickColor,
                        font: tickFont,
                        callback: tickLabelCallback
                    },
                    afterBuildTicks: keepLastTickVisible
                },
                // Sensor value axis
                y: {
                    grid: {
                        color: cssVar('--chart-grid-color')
                    },
                    ticks: {
                        color: cssVar('--chart-tick-color'),
                        font: {
                            size: 9
                        },
                        maxTicksLimit: 5
                    }
                }
            }
        },
        plugins: [
            avgBaselinePlugin
        ]
    });
}
