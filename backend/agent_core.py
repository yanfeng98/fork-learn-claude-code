import os
import json
import asyncio
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

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
    def __init__(self, workdir: str, log_callback, fs_update_callback):
        self.workdir = Path(workdir)
        self.log_callback = log_callback
        self.fs_update_callback = fs_update_callback
        self.model = os.environ.get("OPENAI_MODEL", "deepseek-v3-2-251201")
        self.client = OpenAI(
            api_key=os.environ.get("OPENAI_API_KEY"),
            base_url=os.environ.get("OPENAI_BASE_URL"),
            timeout=1800,
        )
        self.skills = {}
        self.setup_tools()

    async def log(self, content, color=Colors.WHITE):
        await self.log_callback(f"{color}{content}{Colors.RESET}")

    def setup_tools(self):
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
            {
                "type": "function",
                "function": {
                    "name": "write_file",
                    "description": "Write to file.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string"},
                            "content": {"type": "string"}
                        },
                        "required": ["path", "content"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "edit_file",
                    "description": "Replace text in file.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string"},
                            "old_text": {"type": "string"},
                            "new_text": {"type": "string"},
                        },
                        "required": ["path", "old_text", "new_text"],
                    },
                },
            },
        ]

    def safe_path(self, p: str) -> Path:
        path = (self.workdir / p).resolve()
        if not str(path).startswith(str(self.workdir.resolve())):
             raise ValueError(f"Path escapes workspace: {p}")
        return path

    async def execute_tool(self, name: str, args: dict) -> str:
        output = ""
        try:
            if name == "bash":
                cmd = args["command"]
                if "rm -rf /" in cmd or "sudo" in cmd or "shutdown" in cmd:
                    return "Error: Dangerous command"

                process = await asyncio.create_subprocess_shell(
                    cmd, cwd=self.workdir,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=60)
                output = (stdout.decode().strip() + stderr.decode().strip()) or "(no output)"
                await self.fs_update_callback()

            elif name == "read_file":
                p = self.safe_path(args["path"])
                if p.exists():
                    raw_content = p.read_text()[:50000]
                    ext = p.suffix.lstrip(".") or "text"
                    output = f"```{ext}\n{raw_content}\n```"
                else:
                    output = "Error: File not found"

            elif name == "write_file":
                fp = self.safe_path(args["path"])
                fp.parent.mkdir(parents=True, exist_ok=True)
                fp.write_text(args["content"])
                output = f"Wrote {len(args['content'])} bytes to {args['path']}"
                await self.fs_update_callback()

            elif name == "edit_file":
                fp = self.safe_path(args["path"])
                text = fp.read_text()
                if args["old_text"] not in text:
                    return f"Error: Text not found in {args['path']}"
                fp.write_text(text.replace(args["old_text"], args["new_text"], 1))
                output = f"Edited {args['path']}"
                await self.fs_update_callback()

            else:
                output = f"Tool {name} not implemented in demo."

        except asyncio.TimeoutError:
            output = f"Error: Command timed out after 60 seconds."
        except Exception as e:
            output = f"Error executing {name}: {str(e)}"

        return output

    async def step(self, messages: list):
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=self.tools,
                max_tokens=4096
            )

            msg = response.choices[0].message
            messages.append(msg.model_dump())

            if msg.content:
                await self.log(msg.content, Colors.GREEN)

            if not msg.tool_calls:
                return messages

            for tool_call in msg.tool_calls:
                name = tool_call.function.name
                args = json.loads(tool_call.function.arguments)

                await self.log(f"$ {name}: {args}", Colors.YELLOW)

                tool_output = await self.execute_tool(name, args)

                preview = tool_output[:300] + "..." if len(tool_output) > 300 else tool_output
                await self.log(preview, Colors.WHITE)

                messages.append({
                    "role": "tool",
                    "content": tool_output,
                    "tool_call_id": tool_call.id
                })

            return await self.step(messages)

        except Exception as e:
            await self.log(f"System Error: {e}", Colors.RED)
            return messages