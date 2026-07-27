// Station pages: Chart.js visualization
// Creates line charts for each station metric.
// station-data.js updates these charts with live sensor readings.
// cssVar() (used below) is defined in footer.js, which loads first on every page.
// Chart.js plugin that draws an average reference line on each chart
const avgBaselinePlugin = {
    id: 'avgBaseline',
    afterDatasetsDraw(chart) {
        const data =
            chart.data.datasets[0]?.data || [];
        if (!data.length) return;
        // Calculate average value from visible chart data
        const avg =
            data.reduce((a, b) => a + b, 0) / data.length;
        const {
            ctx,
            chartArea: { left, right },
            scales: { y }
        } = chart;
        const yPos =
            y.getPixelForValue(avg);
        // Skip drawing if average is outside chart area
        if (
            yPos < chart.chartArea.top ||
            yPos > chart.chartArea.bottom
        ) {
            return;
        }
        // Draw dashed average line
        ctx.save();
        ctx.strokeStyle =
            cssVar('--chart-avg-line-color');
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(
            left,
            yPos
        );
        ctx.lineTo(
            right,
            yPos
        );
        ctx.stroke();
        // Add average label next to the line
        const yOffset =
            (yPos - chart.chartArea.top < 15)
                ? 12
                : -5;
        ctx.fillStyle =
            cssVar('--chart-avg-label-color');
        ctx.font =
            '10px monospace';
        ctx.textAlign =
            'right';
        ctx.fillText(
            'AVG ' + avg.toFixed(avg > 10 ? 1 : 2),
            right - 6,
            yPos + yOffset
        );
        ctx.restore();
    }
};
// Create a line chart for one station metric
// Stores the Chart.js instance so live-data updates can add readings later.
function buildChart(key, m) {
    const ctx =
        document.getElementById(m.canvas);
    if (ctx) {
        // Provide chart description for screen readers
        ctx.setAttribute(
            'role',
            'img'
        );
        ctx.setAttribute(
            'aria-label',
            'Line chart of recent ' + m.label + ' readings'
        );
    }
    if (!ctx) return;
    const color = cssVar(m.color);
    instances[key] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: color,
                backgroundColor:
                    color + '14',
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
                        // Highlight the newest reading
                        color: (ctx) =>
                            ctx.tick.value ===
                            ctx.scale.getLabels().length - 1
                                ? cssVar('--chart-tick-color-active')
                                : cssVar('--chart-tick-color'),
                        font: (ctx) =>
                            ctx.tick.value ===
                            ctx.scale.getLabels().length - 1
                                ? {
                                    size: 11,
                                    weight: 'bold'
                                }
                                : {
                                    size: 9
                                },
                        // Label the latest reading as "Now"
                        callback: function(value, index) {
                            const isLast =
                                index === this.getLabels().length - 1;
                            const label =
                                this.getLabelForValue(value);
                            return isLast
                                ? 'Now · ' + label
                                : label;
                        }
                    },
                    // Keep newest timestamp visible when Chart.js skips ticks
                    afterBuildTicks: (axis) => {
                        const lastIndex =
                            axis.getLabels().length - 1;
                        if (
                            lastIndex >= 0 &&
                            !axis.ticks.some(
                                t => t.value === lastIndex
                            )
                        ) {
                            axis.ticks.push({
                                value: lastIndex
                            });
                        }
                    }
                },
                // Sensor value axis
                y: {
                    grid: {
                        color:
                            cssVar('--chart-grid-color')
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
