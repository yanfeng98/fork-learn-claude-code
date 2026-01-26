import os
import re
import time
import json
import datetime
import subprocess
import shutil
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# 定义颜色常量，用于前端解析或后端简单处理
class Colors:
    RESET   = "\033[0m"
    RED     = "\033[31m"
    GREEN   = "\033[32m"
    YELLOW  = "\033[33m"
    BLUE    = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN    = "\033[36m"
    WHITE   = "\033[37m"

class AgentSession:
    def __init__(self, workdir: str, log_callback):
        self.workdir = Path(workdir)
        self.log_callback = log_callback # 这是一个异步函数，用于发送日志到前端
        self.model = os.environ.get("OPENAI_MODEL", "deepseek-v3-2-251201")
        self.client = OpenAI(
            api_key=os.environ.get("OPENAI_API_KEY"),
            base_url=os.environ.get("OPENAI_BASE_URL"),
            timeout=1800,
        )
        self.skills = {}
        # 初始化工具定义（精简版，复用你的逻辑）
        self.setup_tools()

    async def log(self, content, color=Colors.WHITE):
        """发送日志到前端"""
        await self.log_callback(f"{color}{content}{Colors.RESET}")

    def setup_tools(self):
        # 这里复用你原本的工具定义，但把 safe_path 绑定到 self.workdir
        self.tools = [
            {
                "type": "function",
                "function": {
                    "name": "bash",
                    "description": "Run shell command.",
                    "parameters": {
                        "type": "object",
                        "properties": {"command": {"type": "string"}},
                        "required": ["command"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "read_file",
                    "description": "Read file contents.",
                    "parameters": {
                        "type": "object",
                        "properties": {"path": {"type": "string"}},
                        "required": ["path"],
                    },
                },
            },
            # ... 你可以继续添加 write_file, edit_file 等
        ]

    def safe_path(self, p: str) -> Path:
        path = (self.workdir / p).resolve()
        # 简单的安全检查
        if not str(path).startswith(str(self.workdir.resolve())):
             raise ValueError(f"Path escapes workspace: {p}")
        return path

    # --- 工具执行函数 ---
    async def execute_tool(self, name: str, args: dict) -> str:
        output = ""
        try:
            if name == "bash":
                # 简单实现 bash
                cmd = args["command"]
                # 安全拦截
                if "rm -rf /" in cmd: return "Error: Dangerous command"
                
                process = subprocess.run(
                    cmd, shell=True, cwd=self.workdir,
                    capture_output=True, text=True, timeout=60
                )
                output = (process.stdout + process.stderr).strip() or "(no output)"
            
            elif name == "read_file":
                p = self.safe_path(args["path"])
                if p.exists():
                    output = p.read_text()[:50000]
                else:
                    output = "Error: File not found"
            
            else:
                output = f"Tool {name} not implemented in demo."

        except Exception as e:
            output = f"Error executing {name}: {str(e)}"
        
        return output

    async def step(self, messages: list):
        """执行一步智能体逻辑"""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=self.tools,
                max_tokens=4096
            )
            
            msg = response.choices[0].message
            messages.append(msg.model_dump())

            # 打印思考过程/回复
            if msg.content:
                await self.log(msg.content, Colors.GREEN)

            if not msg.tool_calls:
                return messages # 对话结束，等待用户输入

            # 处理工具调用
            for tool_call in msg.tool_calls:
                name = tool_call.function.name
                args = json.loads(tool_call.function.arguments)
                
                await self.log(f"$ {name}: {args}", Colors.YELLOW)
                
                tool_output = await self.execute_tool(name, args)
                
                # 截断展示
                preview = tool_output[:300] + "..." if len(tool_output) > 300 else tool_output
                await self.log(preview, Colors.WHITE)

                messages.append({
                    "role": "tool",
                    "content": tool_output,
                    "tool_call_id": tool_call.id
                })
            
            # 工具调用完后，递归调用自身继续处理（直到不需要调用工具）
            return await self.step(messages)

        except Exception as e:
            await self.log(f"System Error: {e}", Colors.RED)
            return messages