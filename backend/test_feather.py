import asyncio
import httpx
from app.config import settings

async def test():
    headers = {"Authorization": f"Bearer {settings.featherless_api_key}", "Content-Type": "application/json"}
    payload = {
        "model": settings.featherless_model,
        "messages": [{"role": "user", "content": [{"type": "text", "text": "hi"}]}],
    }
    async with httpx.AsyncClient() as client:
        res = await client.post("https://api.featherless.ai/v1/chat/completions", headers=headers, json=payload)
        print("STATUS:", res.status_code)
        print("BODY:", res.text.encode('utf-8', errors='replace').decode('utf-8'))

asyncio.run(test())
