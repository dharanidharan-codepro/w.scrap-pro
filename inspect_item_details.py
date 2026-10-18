from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

def test():
    options = webdriver.ChromeOptions()
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-extensions")
    options.add_argument("--no-sandbox")
    options.add_argument("--window-size=1440,900")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument(f"--user-agent={USER_AGENT}")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_argument("--headless=new")

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options,
    )
    
    try:
        url = "https://www.imdb.com/chart/top/"
        driver.get(url)
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "li.ipc-metadata-list-summary-item")
            )
        )
        soup = BeautifulSoup(driver.page_source, "html.parser")
        item = soup.select_one("li.ipc-metadata-list-summary-item")
        if item:
            print("--- ANALYZING ELEMENT ---")
            title_el = item.select_one("h3.ipc-title__text")
            print(f"Title: {title_el.text if title_el else 'None'}")
            
            # Let's list all elements inside `item` and print their class and text
            for idx, el in enumerate(item.find_all(True)):
                text = el.get_text().strip()
                if text and len(text) < 100:
                    print(f"[{idx}] Tag: {el.name}, Classes: {el.get('class')}, Text: {text}")
        else:
            print("Item not found!")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    test()
