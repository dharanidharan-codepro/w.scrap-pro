// ============================================================================
// DOM ELEMENTS
// ============================================================================
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const downloadButton = document.getElementById("downloadButton");
const exportDownloadBtn = document.getElementById("exportDownloadBtn");
const progressBar = document.getElementById("progressBar");
const statusIndicator = document.getElementById("statusIndicator");
const statusMessage = document.getElementById("statusMessage");
const movieCount = document.getElementById("movieCount");
const movieTableBody = document.getElementById("movieTableBody");
const liveCount = document.getElementById("liveCount");
const avgRating = document.getElementById("avgRating");
const progressText = document.getElementById("progressText");
const searchInput = document.getElementById("searchInput");
const ratingFilter = document.getElementById("ratingFilter");
const headlessToggle = document.getElementById("headlessToggle");
const scrapeLimit = document.getElementById("scrapeLimit");
const startRank = document.getElementById("startRank");
const endRank = document.getElementById("endRank");
const metricStatus = document.getElementById("metricStatus");
const movieModal = document.getElementById("movieModal");
const modalClose = document.getElementById("modalClose");
const historyTableBody = document.getElementById("historyTableBody");
const exportRowCount = document.getElementById("exportRowCount");
const exportScrapeStatus = document.getElementById("exportScrapeStatus");

// ============================================================================
// STATE
// ============================================================================
let movies = [];
let ratingChart = null;
let decadeChart = null;
let pollInterval = null;
let refreshDelay = 2000;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
const formatStatus = (state) => {
    const statusMap = {
        "completed": "Completed",
        "scraping": "Scraping",
        "error": "Error",
        "stopped": "Stopped"
    };
    return statusMap[state] || "Idle";
};

const setStatus = (state, message) => {
    statusIndicator.textContent = formatStatus(state);
    statusMessage.textContent = message;
    metricStatus.textContent = formatStatus(state).toUpperCase();

    const colorMap = {
        "scraping": "rgba(0, 255, 234, 0.14)",
        "completed": "rgba(201, 0, 255, 0.14)",
        "error": "rgba(255, 0, 128, 0.18)",
        "stopped": "rgba(255, 165, 0, 0.14)"
    };
    statusIndicator.style.background = colorMap[state] || "rgba(255, 255, 255, 0.08)";
};

// ============================================================================
// FETCH & UPDATE FUNCTIONS
// ============================================================================
const fetchStatus = async () => {
    try {
        const response = await fetch("/scrape-status");
        const data = await response.json();
        movies = data.data || [];
        const history = data.history || [];

        updateDashboard(data);
        renderTable();
        updateExport(data);
        updateAnalytics(data);
        renderHistory(history);
    } catch (error) {
        console.error("Status fetch failed", error);
    }
};

const updateDashboard = (data) => {
    const avg = movies.length
        ? (movies.reduce((sum, item) => sum + item.rating, 0) / movies.length).toFixed(2)
        : 0.0;

    setStatus(data.state, data.message || "Ready to scrape IMDb Top 250.");
    progressBar.style.width = `${data.progress || 0}%`;
    movieCount.textContent = `${data.count || 0} movies loaded`;
    liveCount.textContent = data.count || 0;
    avgRating.textContent = avg;
    progressText.textContent = `${data.progress || 0}%`;

    // Update control buttons
    if (data.state === "scraping") {
        startButton.disabled = true;
        stopButton.disabled = false;
    } else {
        startButton.disabled = false;
        stopButton.disabled = true;
    }
};

const renderTable = () => {
    const term = searchInput.value.trim().toLowerCase();
    const threshold = parseFloat(ratingFilter.value);
    const filtered = movies.filter((movie) => {
        const title = movie.title.toLowerCase();
        const matchesSearch = title.includes(term);

        const matchesRating = isNaN(threshold) ? true : movie.rating >= threshold;
        return matchesSearch && matchesRating;
    });

    movieTableBody.innerHTML = filtered
        .map(
            (movie) => `
        <tr onclick="openMovieModal(${JSON.stringify(movie).replace(/"/g, '&quot;')})">
            <td class="rank-cell">${movie.rank}</td>
            <td>
                <div class="movie-title">
                    <img src="${movie.poster}" alt="${movie.title}" class="movie-thumb" />
                    <div>${movie.title}</div>
                </div>
            </td>
            <td class="year-cell">${movie.year || "—"}</td>
            <td class="duration-cell">${movie.duration || "—"}</td>
            <td class="rating-cell">★ ${movie.rating.toFixed(1)}</td>
        </tr>
    `
        )
        .join("");
};

const updateExport = (data) => {
    exportRowCount.textContent = movies.length;
    exportScrapeStatus.textContent = formatStatus(data.state).toUpperCase();
};

const updateAnalytics = (data) => {
    const totalMovies = movies.length;
    
    // Average Rating
    const avg = totalMovies
        ? (movies.reduce((sum, item) => sum + item.rating, 0) / totalMovies)
        : 0.0;
    
    document.getElementById("analyticsAvgRating").textContent = avg.toFixed(2);
    document.getElementById("analyticsAvgBar").style.width = `${(avg / 10.0) * 100}%`;
    
    // Max / Min Ratings
    let maxRating = 0.0;
    let minRating = 10.0;
    let bestMovie = null;
    
    movies.forEach(movie => {
        if (movie.rating > maxRating) {
            maxRating = movie.rating;
            bestMovie = movie;
        }
        if (movie.rating < minRating) {
            minRating = movie.rating;
        }
    });
    
    if (totalMovies === 0) {
        minRating = 0.0;
    }
    
    document.getElementById("analyticsMaxRating").textContent = maxRating.toFixed(1);
    document.getElementById("analyticsMaxBar").style.width = `${(maxRating / 10.0) * 100}%`;
    document.getElementById("analyticsMinRating").textContent = minRating.toFixed(1);
    document.getElementById("analyticsMinBar").style.width = `${(minRating / 10.0) * 100}%`;
    
    // Rating Categories Count
    let superb = 0; // 9.0+
    let excellent = 0; // 8.5 - 8.9
    let veryGood = 0; // 8.0 - 8.4
    let good = 0; // under 8.0
    
    movies.forEach(m => {
        if (m.rating >= 9.0) superb++;
        else if (m.rating >= 8.5) excellent++;
        else if (m.rating >= 8.0) veryGood++;
        else good++;
    });
    
    document.getElementById("countSuperb").textContent = `${superb} (${totalMovies ? Math.round(superb / totalMovies * 100) : 0}%)`;
    document.getElementById("countExcellent").textContent = `${excellent} (${totalMovies ? Math.round(excellent / totalMovies * 100) : 0}%)`;
    document.getElementById("countVeryGood").textContent = `${veryGood} (${totalMovies ? Math.round(veryGood / totalMovies * 100) : 0}%)`;
    document.getElementById("countGood").textContent = `${good} (${totalMovies ? Math.round(good / totalMovies * 100) : 0}%)`;
    
    // Top Movie Highlight
    const bestMovieHighlight = document.getElementById("bestMovieHighlight");
    if (bestMovie) {
        bestMovieHighlight.style.display = "block";
        document.getElementById("bestMoviePoster").src = bestMovie.poster;
        document.getElementById("bestMovieTitle").textContent = bestMovie.title;
        document.getElementById("bestMovieRating").textContent = bestMovie.rating.toFixed(1);
        document.getElementById("bestMovieRank").textContent = `Rank: #${bestMovie.rank} (${bestMovie.year})`;
    } else {
        bestMovieHighlight.style.display = "none";
    }
    
    // Update Chart
    renderChart();
};

const renderChart = () => {
    const canvas = document.getElementById("ratingsChartCanvas");
    if (!canvas) return;
    
    const ratingLabels = ['8.0', '8.1', '8.2', '8.3', '8.4', '8.5', '8.6', '8.7', '8.8', '8.9', '9.0', '9.1', '9.2', '9.3'];
    const ratingCounts = new Array(ratingLabels.length).fill(0);
    
    movies.forEach(m => {
        const ratingStr = m.rating.toFixed(1);
        const idx = ratingLabels.indexOf(ratingStr);
        if (idx !== -1) {
            ratingCounts[idx]++;
        }
    });
    
    if (ratingChart) {
        ratingChart.data.datasets[0].data = ratingCounts;
        ratingChart.update();
    } else {
        const ctx = canvas.getContext('2d');
        ratingChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ratingLabels,
                datasets: [{
                    label: 'Number of Movies',
                    data: ratingCounts,
                    backgroundColor: 'rgba(0, 240, 255, 0.35)',
                    borderColor: '#00f0ff',
                    borderWidth: 2,
                    borderRadius: 4,
                    hoverBackgroundColor: 'rgba(255, 0, 127, 0.55)',
                    hoverBorderColor: '#ff007f',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#0a0c18',
                        titleColor: '#00f0ff',
                        titleFont: { family: 'Orbitron' },
                        bodyFont: { family: 'Inter' },
                        borderColor: 'rgba(0, 240, 255, 0.2)',
                        borderWidth: 1,
                        displayColors: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                        },
                        ticks: {
                            color: '#7b8cb8',
                            font: { family: 'Share Tech Mono' }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                        },
                        ticks: {
                            color: '#7b8cb8',
                            font: { family: 'Share Tech Mono' },
                            stepSize: 1,
                            precision: 0
                        }
                    }
                }
            }
        });
    }
};

const renderHistory = (history = []) => {
    if (!historyTableBody) return;

    if (history.length === 0) {
        historyTableBody.innerHTML = `
            <tr><td colspan="6" class="empty-history">No scrape sessions available.</td></tr>
        `;
        return;
    }

    historyTableBody.innerHTML = history
        .slice(0, 8)
        .map((session) => {
            const start = session.started_at || "—";
            const range = `${session.start_rank || 1}-${session.end_rank || 250}`;
            const moviesCount = session.movie_count || 0;
            const avgRating = session.avg_rating ? session.avg_rating.toFixed(2) : "—";
            const duration = session.duration_secs !== null ? `${session.duration_secs}s` : "—";
            const status = formatStatus(session.state);

            return `
                <tr>
                    <td>${start}</td>
                    <td>${range}</td>
                    <td>${moviesCount}</td>
                    <td>${avgRating}</td>
                    <td>${status}</td>
                    <td>${duration}</td>
                </tr>
            `;
        })
        .join("");
};

// ============================================================================
// BUTTON HANDLERS
// ============================================================================
const startScrape = async () => {
    const headless = headlessToggle.checked;
    const limit = scrapeLimit.value ? parseInt(scrapeLimit.value, 10) : null;
    const requestedStart = parseInt(startRank.value, 10) || 1;
    const requestedEnd = parseInt(endRank.value, 10) || 250;

    if (requestedStart < 1 || requestedStart > 250 || requestedEnd < 1 || requestedEnd > 250) {
        alert("Please select a start and end rank between 1 and 250.");
        return;
    }

    if (requestedStart > requestedEnd) {
        alert("Start rank must be less than or equal to end rank.");
        return;
    }

    startButton.disabled = true;
    stopButton.disabled = false;

    try {
        const response = await fetch("/start-scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                headless,
                limit,
                start_rank: requestedStart,
                end_rank: requestedEnd,
            }),
        });

        if (response.ok) {
            if (!pollInterval) {
                pollInterval = setInterval(fetchStatus, 1000);
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error("Start scrape failed:", errorData);
            startButton.disabled = false;
            stopButton.disabled = true;
        }
    } catch (error) {
        console.error("Start scrape failed:", error);
        startButton.disabled = false;
        stopButton.disabled = true;
    }
};

const stopScrape = async () => {
    stopButton.disabled = true;
    try {
        await fetch("/stop-scrape", {
            method: "POST",
        });
    } catch (error) {
        console.error("Stop scrape failed:", error);
    }
};

const downloadCsv = () => {
    if (movies.length === 0) {
        alert("No movie data to download. Please scrape first.");
        return;
    }
    window.location.href = "/download-csv";
};

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================
const openMovieModal = (movie) => {
    document.getElementById("modalRank").textContent = `#${movie.rank}`;
    document.getElementById("modalTitle").textContent = movie.title;
    document.getElementById("modalYear").textContent = movie.year || "Unknown";
    document.getElementById("modalDuration").textContent = movie.duration || "Unknown";
    document.getElementById("modalCertificate").textContent = movie.certificate || "N/A";
    document.getElementById("modalRating").textContent = movie.rating.toFixed(1);
    document.getElementById("modalVotes").textContent = `(${movie.votes || "N/A"} votes)`;
    document.getElementById("modalPoster").src = movie.poster;
    movieModal.style.display = "flex";
};

const closeMovieModal = () => {
    movieModal.style.display = "none";
};

// ============================================================================
// VIEW NAVIGATION
// ============================================================================
const navItems = document.querySelectorAll(".nav-item");
navItems.forEach((item) => {
    item.addEventListener("click", () => {
        navItems.forEach((i) => i.classList.remove("active"));
        item.classList.add("active");
        
        const viewName = item.getAttribute("data-view");
        document.querySelectorAll(".view-container").forEach((view) => {
            view.classList.remove("active");
        });
        document.getElementById(viewName).classList.add("active");
    });
});

// ============================================================================
// EVENT LISTENERS
// ============================================================================
startButton.addEventListener("click", startScrape);
stopButton.addEventListener("click", stopScrape);
downloadButton.addEventListener("click", downloadCsv);
exportDownloadBtn.addEventListener("click", downloadCsv);
searchInput.addEventListener("input", renderTable);
ratingFilter.addEventListener("input", renderTable);
modalClose.addEventListener("click", closeMovieModal);

movieModal.addEventListener("click", (e) => {
    if (e.target === movieModal) {
        closeMovieModal();
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================
window.addEventListener("DOMContentLoaded", () => {
    fetchStatus();
    if (!pollInterval) {
        pollInterval = setInterval(fetchStatus, refreshDelay);
    }
});
