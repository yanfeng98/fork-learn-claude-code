import shutil
import uuid
import os
import zipfile
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from agent_core import AgentSession

app = FastAPI()

# 允许跨域（因为前端在 5173 端口，后端在 8000）
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

    # 保存 zip
    zip_path = session_dir / "project.zip"
    with open(zip_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 解压
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(session_dir)
    
    # 删除 zip
    os.remove(zip_path)

    return {"session_id": session_id, "message": "Environment ready"}

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    
    session_dir = BASE_DIR / session_id
    if not session_dir.exists():
        await websocket.close(code=1000, reason="Session not found")
        return

    # 定义回调函数：把日志通过 websocket 发送给前端
    async def send_log(message: str):
        await websocket.send_json({"type": "log", "content": message})

    # 初始化智能体
    agent = AgentSession(str(session_dir), send_log)
    
    # 初始系统 Prompt
    history = [{
        "role": "system", 
        "content": f"You are a coding agent working in {session_dir}. Help the user."
    }]

    await send_log(f"Agent initialized in {session_dir}")

    try:
        while True:
            # 等待前端发送用户指令
            data = await websocket.receive_text()
            user_input = data
            
            # 显示用户输入
            await websocket.send_json({"type": "user", "content": user_input})
            
            history.append({"role": "user", "content": user_input})
            
            # 运行智能体（它会在内部多次调用 send_log）
            history = await agent.step(history)
            
            # 告诉前端这一轮结束了
            await websocket.send_json({"type": "status", "content": "ready"})

    except WebSocketDisconnect:
        print(f"Client #{session_id} disconnected")