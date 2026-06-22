import httpx
import re
import base64
import sys
from pathlib import Path
from urllib.parse import unquote

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
)

SEARCH_ENDPOINT = "https://search.animeonsen.xyz/indexes/content/search"

def load_env() -> dict[str, str]:
    # Traverse upwards to find .env file starting from the script's directory
    curr = Path(__file__).resolve().parent
    for _ in range(5):
        env_path = curr / ".env"
        if env_path.is_file():
            env_vars = {}
            for line in env_path.read_text("utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("=", 1)
                if len(parts) == 2:
                    env_vars[parts[0].strip()] = parts[1].strip().strip('"').strip("'")
            return env_vars
        curr = curr.parent
    return {}

def _parse_ao_session(set_cookie_list: list[str]) -> str:
    combined = ", ".join(set_cookie_list or [])
    m = re.search(r"(?:^|,\s*)ao\.session=([^;]+)", combined, re.I)
    return m.group(1).strip() if m else ""

def _decode_ao_session(raw: str) -> str:
    if not raw:
        return ""
    try:
        decoded_cookie = unquote(raw)
        base_text = base64.b64decode(decoded_cookie).decode("utf-8", errors="ignore")
    except Exception as e:
        print("Decode error:", e)
        return ""
    return "".join(chr(ord(c) + 1) for c in base_text)

async def main():
    # Load search query from command line args or default to "Attack on Titan"
    query = sys.argv[1] if len(sys.argv) > 1 else "Attack on Titan"
    
    # Load .env to get search bearer token
    env = load_env()
    search_token = env.get("VITE_ANIMEONSEN_SEARCH_TOKEN", "")
    
    content_id = None
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        if search_token:
            print(f"Searching AnimeOnsen index for: '{query}'...")
            try:
                search_res = await client.post(
                    SEARCH_ENDPOINT,
                    headers={
                        "accept": "application/json, text/plain, */*",
                        "content-type": "application/json",
                        "authorization": f"Bearer {search_token}",
                        "origin": "https://www.animeonsen.xyz",
                        "referer": "https://www.animeonsen.xyz/",
                        "user-agent": UA,
                    },
                    json={
                        "q": query,
                        "limit": 5,
                    }
                )
                if search_res.status_code == 200:
                    hits = search_res.json().get("hits", [])
                    if hits:
                        chosen = hits[0]
                        content_id = chosen.get("content_id")
                        title = chosen.get("content_title") or chosen.get("content_title_en")
                        print(f"Found anime: '{title}' (ID: {content_id})")
                    else:
                        print(f"No search results found for query '{query}'")
                else:
                    print(f"Search API returned error status {search_res.status_code}")
            except Exception as e:
                print("Failed to perform search:", e)
        else:
            print("Warning: VITE_ANIMEONSEN_SEARCH_TOKEN not found in .env. Skipping index search.")

        # Fallback to default ID if search failed or search token was missing
        if not content_id:
            # '6PGE1LU1INC9XAQf' is the content ID of Attack on Titan Season 1
            content_id = "6PGE1LU1INC9XAQf"
            print(f"Falling back to default content ID: {content_id}")

        watch_url = f"https://www.animeonsen.xyz/watch/{content_id}?episode=1"
        print(f"Fetching watch URL to get cookie: {watch_url}")
        
        try:
            wr = await client.get(
                watch_url,
                headers={
                    "accept": "text/html,application/xhtml+xml,*/*;q=0.8",
                    "user-agent": UA,
                },
            )
            cookies = wr.headers.get_list("set-cookie")
            ao_session = _parse_ao_session(cookies)
            
            if ao_session:
                token = _decode_ao_session(ao_session)
                print("\nSuccessfully generated AnimeOnsen player bearer token:\n")
                print(token)
                print()
            else:
                print("Error: No ao.session cookie found in response headers!")
        except Exception as e:
            print("Failed to resolve bearer token:", e)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
