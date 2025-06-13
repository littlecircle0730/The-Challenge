print("SIGNALING SERVER __FILE__ =", __file__)
print("SIGNALING SERVER starting…")

import asyncio
import json
from aiohttp import web, WSMsgType
from aiortc.contrib.signaling import object_to_string, object_from_string

ROOM = {
    "offerer": None,
    "answerer": None
}

async def websocket_handler(request):
    role = request.match_info["role"]
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    # register
    ROOM[role] = ws
    print(f"[signaling] {role} connected")

    # message loop
    async for msg in ws:
        if msg.type == WSMsgType.TEXT:
            data = msg.data
            # forward to the other peer
            peer = "answerer" if role == "offerer" else "offerer"
            if ROOM[peer]:
                await ROOM[peer].send_str(data)
        elif msg.type == WSMsgType.ERROR:
            break

    # cleanup
    ROOM[role] = None
    print(f"[signaling] {role} disconnected")
    return ws

app = web.Application()
app.router.add_get("/ws/{role}", websocket_handler)

if __name__ == "__main__":
    web.run_app(app, host="0.0.0.0", port=1234)
