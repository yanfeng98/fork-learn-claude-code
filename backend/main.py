import os
import uuid
import zipfile
import asyncio
import aiofiles
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from agent_core import AgentSession

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent / "workspaces"
BASE_DIR.mkdir(exist_ok=True)

@app.post("/upload")
async def upload_project(file: UploadFile = File(...)):
    session_id = str(uuid.uuid4())
    session_dir = BASE_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    zip_path = session_dir / "project.zip"

    async with aiofiles.open(zip_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: unzip_file(zip_path, session_dir))
    
    os.remove(zip_path)

    return {"session_id": session_id, "message": "Environment ready"}

def unzip_file(zip_path, target_dir):
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(target_dir)

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    
    session_dir = BASE_DIR / session_id
    if not session_dir.exists():
        await websocket.close(code=1000, reason="Session not found")
        return

    safe_path = (BASE_DIR / session_id).resolve()
    if not str(safe_path).startswith(str(BASE_DIR.resolve())):
        await websocket.close(code=1008, reason="Invalid session ID")
        return

    async def send_log(message: str):
        await websocket.send_json({"type": "log", "content": message})

    agent = AgentSession(str(session_dir), send_log)
    
    history = [{
        "role": "system", 
        "content": f"You are a coding agent working in {session_dir}. Help the user."
    }]

    await send_log(f"Agent initialized in {session_dir}")

    try:
        while True:
            data = await websocket.receive_text()
            user_input = data
            
            await websocket.send_json({"type": "user", "content": user_input})
            
            history.append({"role": "user", "content": user_input})
            history = await agent.step(history)
            
            await websocket.send_json({"type": "status", "content": "ready"})

    except WebSocketDisconnect:
        print(f"Client #{session_id} disconnected")