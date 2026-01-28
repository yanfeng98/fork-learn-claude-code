import os
import io
import uuid
import shutil
import zipfile
import asyncio
import aiofiles
import datetime
from pathlib import Path
from watchfiles import awatch
from agent_core import AgentSession
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent / "../workspaces"
BASE_DIR.mkdir(exist_ok=True)

active_connections: dict[str, WebSocket] = {}

def get_file_tree(session_dir: Path, current_path: Path):
    tree = []
    for item in current_path.iterdir():
        if item.name == "backend" or item.name == "venv" or item.name.startswith("."):
            continue

        rel_path = item.relative_to(session_dir).as_posix()
        if item.is_dir():
            tree.append({
                "name": item.name,
                "path": rel_path,
                "type": "directory",
                "children": get_file_tree(session_dir, item)
            })
        else:
            tree.append({
                "name": item.name,
                "path": rel_path,
                "type": "file"
            })
    return sorted(tree, key=lambda x: (x["type"] == "file", x["name"]))

async def read_file_content(session_dir: Path, file_path: str):
    full_path = (session_dir / file_path).resolve()
    if not str(full_path).startswith(str(session_dir.resolve())):
        raise ValueError("Attempt to read file outside of workspace.")
    if not full_path.is_file():
        return None
    return full_path.read_text()

async def write_file_content(session_dir: Path, file_path: str, content: str):
    full_path = (session_dir / file_path).resolve()
    if not str(full_path).startswith(str(session_dir.resolve())):
        raise ValueError("Attempt to write file outside of workspace.")

    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_text(content)
    if full_path.exists():
        await broadcast_fs_update(session_dir.name)

async def filesystem_watcher(session_id: str, session_dir: Path):
    try:
        async for changes in awatch(str(session_dir)):
            await broadcast_fs_update(session_id)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"Filesystem watcher error for {session_id}: {e}")

async def broadcast_fs_update(session_id: str):
    if session_id in active_connections:
        try:
            await active_connections[session_id].send_json({"type": "fs_update"})
        except RuntimeError as e:
            print(f"Error sending fs_update to {session_id}: {e}")
            await remove_connection(session_id)

async def remove_connection(session_id: str):
    if session_id in active_connections:
        del active_connections[session_id]
        print(f"Removed connection {session_id}")

@app.post("/upload")
async def upload_project(file: UploadFile = File(...)):
    session_id = str(uuid.uuid4())
    session_dir = BASE_DIR / session_id
    if session_dir.exists():
        shutil.rmtree(session_dir)
    session_dir.mkdir(parents=True, exist_ok=True)

    zip_path = session_dir / "project.zip"
    async with aiofiles.open(zip_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: unzip_file(zip_path, session_dir))

    os.remove(zip_path)
    asyncio.create_task(filesystem_watcher(session_id, session_dir))

    return {"session_id": session_id, "message": "Environment ready"}

def unzip_file(zip_path, target_dir):
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(target_dir)

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    active_connections[session_id] = websocket

    session_dir = BASE_DIR / session_id
    if not session_dir.exists():
        await websocket.close(code=1000, reason="Session not found")
        await remove_connection(session_id)
        return

    safe_path = (BASE_DIR / session_id).resolve()
    if not str(safe_path).startswith(str(BASE_DIR.resolve())):
        await websocket.close(code=1008, reason="Invalid session ID")
        await remove_connection(session_id)
        return

    async def send_log(message: str):
        try:
            await websocket.send_json({"type": "log", "content": message})
        except RuntimeError:
            await remove_connection(session_id)

    async def fs_update_callback():
        await broadcast_fs_update(session_id)

    agent = AgentSession(str(session_dir), send_log, fs_update_callback)

    history = [{
        "role": "system",
        "content": f"You are a coding agent working in {session_dir}. Help the user. Current time: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    }]

    await send_log(f"Agent initialized in {session_dir}")
    await broadcast_fs_update(session_id)

    try:
        while True:
            data = await websocket.receive_json()

            if data["type"] == "user_message":
                user_input = data["content"]
                await websocket.send_json({"type": "user", "content": user_input})
                history.append({"role": "user", "content": user_input})
                history = await agent.step(history)
                await websocket.send_json({"type": "status", "content": "ready"})

            elif data["type"] == "get_file_tree":
                tree = get_file_tree(session_dir, session_dir)
                await websocket.send_json({"type": "file_tree", "content": tree})

            elif data["type"] == "read_file":
                file_content = await read_file_content(session_dir, data["path"])
                await websocket.send_json({"type": "file_content", "path": data["path"], "content": file_content})

            elif data["type"] == "save_file":
                await write_file_content(session_dir, data["path"], data["content"])
                await websocket.send_json({"type": "status", "content": f"Saved {data['path']}"})
                await broadcast_fs_update(session_id)

    except WebSocketDisconnect:
        print(f"Client #{session_id} disconnected")
    except Exception as e:
        print(f"WebSocket error for {session_id}: {e}")
    finally:
        await remove_connection(session_id)

@app.get("/download/{session_id}")
async def download_project(session_id: str):
    session_dir = (BASE_DIR / session_id).resolve()
    if not session_dir.exists() or not session_dir.is_dir():
        return {"error": "Session not found"}

    # 防止路径穿越
    if not str(session_dir).startswith(str(BASE_DIR.resolve())):
        return {"error": "Invalid session"}

    zip_bytes = await asyncio.get_event_loop().run_in_executor(
        None, lambda: zip_workspace(session_dir)
    )

    filename = f"{session_id}.zip"
    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

def zip_workspace(session_dir: Path) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for p in session_dir.rglob("*"):
            if p.is_dir():
                continue

            # 过滤不想打包的内容
            rel = p.relative_to(session_dir).as_posix()
            if rel == "project.zip":
                continue
            if any(part.startswith(".") for part in p.relative_to(session_dir).parts):
                continue
            if p.name in {"venv"} or "venv/" in rel:
                continue
            if rel.startswith("backend/"):
                continue

            zf.write(p, arcname=rel)

    buf.seek(0)
    return buf.getvalue()
