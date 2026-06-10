"""
===============================================
Scrapes IMDb Top 250 movies using Selenium + BeautifulSoup hybrid approach.
Extracts: Rank, Title, Year, Rating, Duration, Certificate, Votes, Poster URL.
Exposes REST API endpoints for the frontend dashboard.
"""
from flask import Flask, render_template, jsonify, request, send_file
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import threading
import pandas as pd
import time
import io
import re
from datetime import datetime

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Shared scraper state (thread-safe via GIL for simple dict updates)
# ---------------------------------------------------------------------------
scrape_thread = None
stop_event = threading.Event()

scrape_status = {
    "state": "idle",           # idle | scraping | completed | error | stopped
    "message": "Ready to scrape IMDb Top 250.",
    "progress": 0,
    "count": 0,
    "data": [],
    "logs": [],                # terminal console log entries
    "history": [],
    "started_at": None,
    "finished_at": None,
}

SCRAPE_URL = "https://www.imdb.com/chart/top/"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def log(message: str, level: str = "INFO"):
    """Append a timestamped log entry to the shared state."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    entry = f"[{timestamp}] [{level}] {message}"
    scrape_status["logs"].append(entry)
    # Keep log buffer manageable
    if len(scrape_status["logs"]) > 500:
        scrape_status["logs"] = scrape_status["logs"][-400:]


# ---------------------------------------------------------------------------
# Selenium driver factory
# ---------------------------------------------------------------------------
def create_driver(headless: bool = True):
    options = webdriver.ChromeOptions()
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-extensions")
    options.add_argument("--no-sandbox")
    options.add_argument("--window-size=1440,900")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument(f"--user-agent={USER_AGENT}")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    if headless:
        options.add_argument("--headless=new")
    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options,
    )
    return driver


# ---------------------------------------------------------------------------
# Modern IMDb parser (2024+ layout)
# ---------------------------------------------------------------------------
def parse_modern_layout(soup):
    """Parse li.ipc-metadata-list-summary-item elements (current IMDb layout)."""
    items = soup.find_all("li", class_="ipc-metadata-list-summary-item")
    movies = []
    for item in items:
        try:
            title_el = item.find("h4", class_="ipc-title__text")
            title = title_el.text.strip() if title_el else ""

            rank_el = item.find("div", class_="ipc-signpost__text")
            rank_str = rank_el.text.strip().lstrip("#") if rank_el else ""

            metadata_items = item.find_all("li", class_="ipc-inline-list__item")
            year = metadata_items[0].text.strip() if len(metadata_items) > 0 else ""
            duration = metadata_items[1].text.strip() if len(metadata_items) > 1 else ""
            certificate = metadata_items[2].text.strip() if len(metadata_items) > 2 else ""

            rating_el = item.find("span", class_="ipc-rating-star--rating")
            rating_raw = rating_el.text.strip() if rating_el else "0"
            rating_match = re.search(r"[\d.]+", rating_raw)
            rating = float(rating_match.group()) if rating_match else 0.0

            votes_el = item.find("span", class_="ipc-rating-star--voteCount")
            votes = votes_el.text.strip().strip("()") if votes_el else ""

            poster_el = item.find("img", class_="ipc-image") or item.find("img")
            poster = poster_el.get("src", "") if poster_el else ""

            movie = {
                "rank": int(rank_str) if rank_str.isdigit() else 0,
                "title": title,
                "year": year,
                "rating": rating,
                "duration": duration,
                "certificate": certificate,
                "votes": votes,
                "poster": poster,
            }
            movies.append(movie)
        except Exception:
            continue
    return movies


# ---------------------------------------------------------------------------
# Legacy IMDb parser (pre-2024 table layout — fallback)
# ---------------------------------------------------------------------------
def parse_legacy_layout(soup):
    """Parse table.chart.full-width layout (legacy IMDb layout)."""
    table = soup.find("table", class_="chart")
    movies = []
    if table:
        tbody = table.find("tbody", class_="lister-list")
        rows = tbody.find_all("tr") if tbody else []
    else:
        rows = []

    for row in rows:
        try:
            title_col = row.find(class_="titleColumn")
            rank = title_col.text.split(".")[0].strip() if title_col else "0"
            title = title_col.find("a").text.strip() if title_col and title_col.find("a") else ""
            year_el = title_col.find("span", class_="secondaryInfo") if title_col else None
            year = year_el.text.strip("() ") if year_el else ""

            rating_cell = row.find(class_="imdbRating")
            rating_el = rating_cell.find("strong") if rating_cell else None
            rating = float(rating_el.text.strip()) if rating_el else 0.0

            poster_col = row.find(class_="posterColumn")
            poster_el = poster_col.find("img") if poster_col else None
            poster = poster_el.get("src", "") if poster_el else ""

            movie = {
                "rank": int(rank) if rank.isdigit() else 0,
                "title": title,
                "year": year,
                "rating": rating,
                "duration": "",
                "certificate": "",
                "votes": "",
                "poster": poster,
            }
            movies.append(movie)
        except Exception:
            continue
    return movies


# ---------------------------------------------------------------------------
# Scraper orchestrator (runs in background thread)
# ---------------------------------------------------------------------------
def scrape_imdb_top250(headless: bool = True, limit: int | None = None, start_rank: int = 1, end_rank: int = 250):
    global scrape_status
    stop_event.clear()
    scrape_status["state"] = "scraping"
    scrape_status["message"] = "Initializing Chrome WebDriver..."
    scrape_status["progress"] = 0
    scrape_status["count"] = 0
    scrape_status["data"] = []
    scrape_status["logs"] = []
    scrape_status["started_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    scrape_status["finished_at"] = None

    start_rank = max(1, min(start_rank, 250))
    end_rank = max(start_rank, min(end_rank, 250))
    if limit and limit > 0:
        end_rank = min(end_rank, start_rank + limit - 1)

    start_ts = time.time()
    session = {
        "id": datetime.now().strftime("%Y%m%d%H%M%S"),
        "state": "scraping",
        "started_at": scrape_status["started_at"],
        "finished_at": None,
        "movie_count": 0,
        "requested_limit": limit if limit else 250,
        "start_rank": start_rank,
        "end_rank": end_rank,
        "duration_secs": None,
        "avg_rating": 0.0,
        "message": "Scraper session initialized.",
    }
    scrape_status["history"].insert(0, session)
    log("Scraper session started.", "SYSTEM")
    log(f"Headless mode: {'ON' if headless else 'OFF'}", "CONFIG")
    log(f"Requested scrape range: ranks {start_rank} - {end_rank} (limit {session['requested_limit']}).", "CONFIG")

    driver = None
    try:
        log("Downloading / verifying ChromeDriver via webdriver-manager...", "SETUP")
        driver = create_driver(headless=headless)
        log("Chrome WebDriver initialized successfully.", "SETUP")

        if stop_event.is_set():
            scrape_status["state"] = "stopped"
            scrape_status["message"] = "Scraping was cancelled before page load."
            session["state"] = "stopped"
            session["message"] = scrape_status["message"]
            return

        log(f"Navigating to {SCRAPE_URL}...", "NAVIGATE")
        scrape_status["message"] = "Loading IMDb Top 250 page..."
        driver.get(SCRAPE_URL)
        log("Page loaded. Waiting for content to render...", "NAVIGATE")

        # Wait for either modern or legacy layout
        try:
            WebDriverWait(driver, 20).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, "li.ipc-metadata-list-summary-item, table.chart")
                )
            )
            log("Content elements detected on page.", "PARSE")
        except Exception as wait_err:
            log(f"Timeout waiting for content: {wait_err}", "ERROR")
            scrape_status["state"] = "error"
            scrape_status["message"] = "Timed out waiting for IMDb page to load."
            return

        if stop_event.is_set():
            return

        # Scroll down to trigger lazy loading of posters and load all list items
        log("Scrolling page to trigger lazy-loaded content...", "SCROLL")
        scrape_status["message"] = "Scrolling to load all movie posters..."
        last_height = driver.execute_script("return document.body.scrollHeight")
        scroll_attempts = 0
        while True:
            if stop_event.is_set():
                scrape_status["state"] = "stopped"
                scrape_status["message"] = "Scraping was cancelled during page scroll."
                session["state"] = "stopped"
                session["message"] = scrape_status["message"]
                return
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(0.5)
            new_height = driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height:
                break
            last_height = new_height
            scroll_attempts += 1
            if scroll_attempts >= 20:
                break

        # Give the browser one final moment to render lazy-loaded content
        time.sleep(1)
        log("Scroll complete. Capturing page source...", "SCROLL")

        # Parse with BeautifulSoup for speed
        soup = BeautifulSoup(driver.page_source, "html.parser")

        # Try modern layout first
        log("Attempting modern IMDb layout parser...", "PARSE")
        all_movies = parse_modern_layout(soup)

        if not all_movies:
            log("Modern layout yielded no results. Trying legacy parser...", "PARSE")
            all_movies = parse_legacy_layout(soup)

        if not all_movies:
            log("No movies found with any parser.", "ERROR")
            scrape_status["state"] = "error"
            scrape_status["message"] = "Could not find any movie elements on the page."
            session["state"] = "error"
            session["message"] = scrape_status["message"]
            return

        selected_movies = [
            movie for movie in all_movies
            if start_rank <= movie.get("rank", 0) <= end_rank
        ]
        selected_movies.sort(key=lambda movie: movie.get("rank", 0))

        total = len(selected_movies)
        if total == 0:
            log("Requested scrape range did not match any extracted movies.", "ERROR")
            scrape_status["state"] = "error"
            scrape_status["message"] = "No movies found for the selected rank range."
            session["state"] = "error"
            session["message"] = scrape_status["message"]
            return

        log(f"Found {len(all_movies)} movies; scraping {total} movies for the requested range.", "SCRAPE")
        scrape_status["message"] = f"Scraping ranks {start_rank}-{end_rank} ({total} movies)."
        session["message"] = scrape_status["message"]

        # Stream movies to the dashboard one-by-one for live progress effect
        for index, movie in enumerate(selected_movies, start=1):
            if stop_event.is_set():
                log("Stop signal received. Halting scraper.", "SYSTEM")
                scrape_status["state"] = "stopped"
                scrape_status["message"] = f"Scraping stopped by user at {index - 1}/{total} movies."
                session["state"] = "stopped"
                session["message"] = scrape_status["message"]
                session["movie_count"] = index - 1
                break

            scrape_status["data"].append(movie)
            scrape_status["count"] = index
            scrape_status["progress"] = int(index / total * 100)
            scrape_status["message"] = f"Scraping {index}/{total}: {movie['title']}"
            session["movie_count"] = index

            if index % 10 == 0 or index == 1 or index == total:
                log(
                    f"Scraped #{movie['rank']}: {movie['title']} ({movie['year']}) — ★ {movie['rating']}",
                    "SCRAPE",
                )

            # Small delay for visual streaming effect on frontend
            time.sleep(0.04)

        if not stop_event.is_set():
            scrape_status["state"] = "completed"
            scrape_status["message"] = f"Successfully scraped {total} movies!"
            session["state"] = "completed"
            session["message"] = scrape_status["message"]
            log(f"Scraping completed! {total} movies extracted.", "DONE")

    except Exception as error:
        scrape_status["state"] = "error"
        scrape_status["message"] = f"Error: {error}"
        log(f"Critical error: {error}", "ERROR")
    finally:
        if driver:
            driver.quit()
            log("Chrome WebDriver closed.", "SYSTEM")
        scrape_status["finished_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        session["finished_at"] = scrape_status["finished_at"]
        session["duration_secs"] = round(time.time() - start_ts, 2)
        if scrape_status["data"]:
            session["avg_rating"] = round(
                sum(item.get("rating", 0) for item in scrape_status["data"]) / len(scrape_status["data"]),
                2,
            )
        if scrape_status["state"] == "scraping":
            scrape_status["state"] = "completed"
            session["state"] = "completed"
            session["message"] = scrape_status["message"]


# ---------------------------------------------------------------------------
# Flask routes
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/start-scrape", methods=["POST"])
def start_scrape():
    global scrape_thread
    if scrape_thread and scrape_thread.is_alive():
        return jsonify({"status": "busy", "message": "Scraping is already running."}), 409

    content = request.json or {}
    headless = bool(content.get("headless", True))
    limit = content.get("limit")
    start_rank = content.get("start_rank", 1)
    end_rank = content.get("end_rank", 250)

    try:
        limit = int(limit) if limit is not None else None
    except (TypeError, ValueError):
        limit = None

    try:
        start_rank = int(start_rank)
    except (TypeError, ValueError):
        start_rank = 1

    try:
        end_rank = int(end_rank)
    except (TypeError, ValueError):
        end_rank = 250

    scrape_thread = threading.Thread(
        target=scrape_imdb_top250,
        args=(headless, limit, start_rank, end_rank),
        daemon=True,
    )
    scrape_thread.start()
    return jsonify({
        "status": "started",
        "message": "Scraping started.",
        "headless": headless,
        "limit": limit,
        "start_rank": start_rank,
        "end_rank": end_rank,
    })


@app.route("/stop-scrape", methods=["POST"])
def stop_scrape():
    if not scrape_thread or not scrape_thread.is_alive():
        return jsonify({"status": "idle", "message": "No scraping session is active."}), 400

    stop_event.set()
    return jsonify({"status": "stopping", "message": "Stop signal sent."})


@app.route("/scrape-status")
def status():
    return jsonify(scrape_status)


@app.route("/movies")
def movies():
    return jsonify(scrape_status.get("data", []))


@app.route("/download-csv")
def download_csv():
    data = scrape_status.get("data", [])
    if not data:
        return jsonify({"status": "empty", "message": "No movie data available to export."}), 400

    df = pd.DataFrame(data)
    csv_buffer = io.StringIO()
    df.to_csv(csv_buffer, index=False)
    csv_buffer.seek(0)

    return send_file(
        io.BytesIO(csv_buffer.getvalue().encode("utf-8")),
        mimetype="text/csv",
        as_attachment=True,
        download_name="imdb_top250_scrape.csv",
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
