#!/usr/bin/env python3
import os
import time
import json
import datetime
import subprocess
from pathlib import Path
from openai import OpenAI
from rich.align import Align
from rich.box import ROUNDED
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from dotenv import load_dotenv

load_dotenv()

class Colors:
    RESET   = "\033[0m"
    BLACK   = "\033[30m"
    RED     = "\033[31m"
    GREEN   = "\033[32m"
    YELLOW  = "\033[33m"
    BLUE    = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN    = "\033[36m"
    WHITE   = "\033[37m"

MODEL = os.environ.get("OPENAI_MODEL", "deepseek-v3-2-251201")
WORKDIR = Path.cwd()

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
    base_url=os.environ.get("OPENAI_BASE_URL"),
    timeout=1800,
)

AGENT_TYPES = {
    "explore": {
        "description": "Read-only agent for exploring code, finding files, searching",
        "tools": ["bash", "read_file"],
        "prompt": "You are an exploration agent. Search and analyze, but never modify files. Return a concise summary.",
    },
    "code": {
        "description": "Full agent for implementing features and fixing bugs",
        "tools": "*",
        "prompt": "You are a coding agent. Implement the requested changes efficiently.",
    },
    "plan": {
        "description": "Planning agent for designing implementation strategies",
        "tools": ["bash", "read_file"],
        "prompt": "You are a planning agent. Analyze the codebase and output a numbered implementation plan. Do NOT make changes.",
    },
}


def get_agent_descriptions() -> str:
    return "\n".join(
        f"- {name}: {cfg['description']}"
        for name, cfg in AGENT_TYPES.items()
    )

class TodoManager:

    def __init__(self):
        self.items = []

    def update(self, items: list) -> str:
        validated = []
        in_progress = 0

        for i, item in enumerate(items):
            content = str(item.get("content", "")).strip()
            status = str(item.get("status", "pending")).lower()
            active = str(item.get("activeForm", "")).strip()

            if not content or not active:
                raise ValueError(f"Item {i}: content and activeForm required")
            if status not in ("pending", "in_progress", "completed"):
                raise ValueError(f"Item {i}: invalid status")
            if status == "in_progress":
                in_progress += 1

            validated.append({
                "content": content,
                "status": status,
                "activeForm": active
            })

        if in_progress > 1:
            raise ValueError("Only one task can be in_progress")

        self.items = validated[:20]
        return self.render()

    def render(self) -> str:
        if not self.items:
            return "No todos."
        lines = []
        for t in self.items:
            mark = "[x]" if t["status"] == "completed" else \
                   "[>]" if t["status"] == "in_progress" else "[ ]"
            lines.append(f"{mark} {t['content']}")
        done = sum(1 for t in self.items if t["status"] == "completed")
        return "\n".join(lines) + f"\n({done}/{len(self.items)} done)"


TODO = TodoManager()

SYSTEM = f"""You are a coding agent at {WORKDIR}.

Loop: plan -> act with tools -> report.

You can spawn subagents for complex subtasks:
{get_agent_descriptions()}

Rules:
- Use Task tool for subtasks that need focused exploration or implementation
- Use TodoWrite to track multi-step work
- Prefer tools over prose. Act, don't just explain.
- After finishing, summarize what changed."""

BASE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "bash",
            "description": "Run shell command.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string"}
                },
                "required": ["command"],
            },
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read file contents.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "limit": {"type": "integer"}
                },
                "required": ["path"],
            },
        }
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
        }
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
        }
    },
    {
        "type": "function",
        "function": {
            "name": "TodoWrite",
            "description": "Update task list.",
            "parameters": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "content": {"type": "string"},
                                "status": {
                                    "type": "string",
                                    "enum": ["pending", "in_progress", "completed"]
                                },
                                "activeForm": {"type": "string"},
                            },
                            "required": ["content", "status", "activeForm"],
                        },
                    }
                },
                "required": ["items"],
            },
        }
    },
]

TASK_TOOL = {
    "type": "function",
    "function": {
        "name": "Task",
        "description": f"""Spawn a subagent for a focused subtask.

Subagents run in ISOLATED context - they don't see parent's history.
Use this to keep the main conversation clean.

Agent types:
{get_agent_descriptions()}

Example uses:
- Task(explore): "Find all files using the auth module"
- Task(plan): "Design a migration strategy for the database"
- Task(code): "Implement the user registration form"
""",
        "parameters": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": "Short task name (3-5 words) for progress display"
                },
                "prompt": {
                    "type": "string",
                    "description": "Detailed instructions for the subagent"
                },
                "agent_type": {
                    "type": "string",
                    "enum": list(AGENT_TYPES.keys()),
                    "description": "Type of agent to spawn"
                },
            },
            "required": ["description", "prompt", "agent_type"],
        },
    }
}

ALL_TOOLS = BASE_TOOLS + [TASK_TOOL]


def get_tools_for_agent(agent_type: str) -> list:
    allowed = AGENT_TYPES.get(agent_type, {}).get("tools", "*")

    if allowed == "*":
        return BASE_TOOLS

    return [t for t in BASE_TOOLS if t["function"]["name"] in allowed]

def safe_path(p: str) -> Path:
    path = (WORKDIR / p).resolve()
    if not path.is_relative_to(WORKDIR):
        raise ValueError(f"Path escapes workspace: {p}")
    return path


def run_bash(cmd: str) -> str:
    if any(d in cmd for d in ["rm -rf /", "sudo", "shutdown"]):
        return "Error: Dangerous command"
    try:
        r = subprocess.run(
            cmd, shell=True, cwd=WORKDIR,
            capture_output=True, text=True, timeout=60
        )
        return ((r.stdout + r.stderr).strip() or "(no output)")[:50000]
    except Exception as e:
        return f"Error: {e}"


def run_read(path: str, limit: int = None) -> str:
    try:
        lines = safe_path(path).read_text().splitlines()
        if limit:
            lines = lines[:limit]
        return "\n".join(lines)[:50000]
    except Exception as e:
        return f"Error: {e}"


def run_write(path: str, content: str) -> str:
    try:
        fp = safe_path(path)
        fp.parent.mkdir(parents=True, exist_ok=True)
        fp.write_text(content)
        return f"Wrote {len(content)} bytes to {path}"
    except Exception as e:
        return f"Error: {e}"


def run_edit(path: str, old_text: str, new_text: str) -> str:
    try:
        fp = safe_path(path)
        text = fp.read_text()
        if old_text not in text:
            return f"Error: Text not found in {path}"
        fp.write_text(text.replace(old_text, new_text, 1))
        return f"Edited {path}"
    except Exception as e:
        return f"Error: {e}"


def run_todo(items: list) -> str:
    try:
        return TODO.update(items)
    except Exception as e:
        return f"Error: {e}"

def run_task(description: str, prompt: str, agent_type: str) -> str:
    if agent_type not in AGENT_TYPES:
        return f"Error: Unknown agent type '{agent_type}'"

    config = AGENT_TYPES[agent_type]
    sub_system = f"""You are a {agent_type} subagent at {WORKDIR}.

{config["prompt"]}

Complete the task and return a clear, concise summary."""

    sub_tools = get_tools_for_agent(agent_type)

    sub_messages = [
        {"role": "system", "content": sub_system},
        {"role": "user", "content": prompt}
    ]

    print(f"{Colors.MAGENTA}[{agent_type}] {description}{Colors.RESET}")
    start = time.time()
    tool_count = 0

    while True:

        completion = client.chat.completions.create(
            model=MODEL,
            messages=sub_messages,
            tools=sub_tools,
            max_tokens=32 * 1024,
        )

        if completion.choices[0].finish_reason != "tool_calls":
            break

        sub_messages.append(completion.choices[0].message.model_dump())

        print(f"{Colors.GREEN}{completion.choices[0].message.content.strip()}{Colors.RESET}")

        tool_calls = completion.choices[0].message.tool_calls
        for tool_call in tool_calls:
            tool_count += 1
            tool_name = tool_call.function.name
            function_args = json.loads(tool_call.function.arguments)
            print(f"{Colors.YELLOW}$ {tool_name}: {function_args}{Colors.RESET}")

            output = execute_tool(tool_name, function_args)
            preview = output[:300] + "..." if len(output) > 300 else output
            print(f"{Colors.WHITE}{preview or '(empty)'}{Colors.RESET}")
            sub_messages.append(
                {"role": "tool", "content": output[:50000], "tool_call_id": tool_call.id}
            )

            elapsed = time.time() - start
            print(f"{Colors.BLUE}[{agent_type}] {description} ... {tool_count} tools, {elapsed:.1f}s{Colors.RESET}")

    elapsed = time.time() - start
    print(f"{Colors.BLUE}[{agent_type}] {description} - done ({tool_count} tools, {elapsed:.1f}s){Colors.RESET}")

    if completion.choices[0].message.content:
        return completion.choices[0].message.content

    return "(subagent returned no text)"


def execute_tool(name: str, args: dict) -> str:
    if name == "bash":
        return run_bash(args["command"])
    if name == "read_file":
        return run_read(args["path"], args.get("limit"))
    if name == "write_file":
        return run_write(args["path"], args["content"])
    if name == "edit_file":
        return run_edit(args["path"], args["old_text"], args["new_text"])
    if name == "TodoWrite":
        return run_todo(args["items"])
    if name == "Task":
        return run_task(args["description"], args["prompt"], args["agent_type"])
    return f"Unknown tool: {name}"

def agent_loop(messages: list) -> list:
    while True:
        completion = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=ALL_TOOLS,
            max_tokens=32 * 1024,
        )

        messages.append(completion.choices[0].message.model_dump())

        print(f"{Colors.GREEN}{completion.choices[0].message.content.strip()}{Colors.RESET}")

        if completion.choices[0].finish_reason != "tool_calls":
            return messages
        
        tool_calls = completion.choices[0].message.tool_calls
        for tool_call in tool_calls:
            tool_name = tool_call.function.name
            function_args = json.loads(tool_call.function.arguments)
            if tool_name != "TodoWrite":
                print(f"{Colors.YELLOW}$ {tool_name}: {function_args}{Colors.RESET}")

            output = execute_tool(tool_name, function_args)
            if tool_name != "Task":
                preview = output[:300] + "..." if len(output) > 300 else output
                print(f"{Colors.WHITE}{preview or '(empty)'}{Colors.RESET}")
            messages.append(
                {"role": "tool", "content": output[:50000], "tool_call_id": tool_call.id}
            )

def main():

    console = Console()

    message = Text.from_markup(f"Mini Claude Code v3 (with Subagents) - [green]{WORKDIR}[/]\nCurrent Time: [green]{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}[/]\nAgent Types: [green]{', '.join(AGENT_TYPES.keys())}[/]")
    content = Align(message, align="center")

    panel = Panel(
        content,
        title="[bold yellow]Control Panel[/]",
        subtitle="[dim]Type 'exit' to quit[/]",
        border_style="blue",
        box=ROUNDED,
        padding=(1, 2),
        expand=True,
        highlight=True,
    )

    console.print(panel)

    history = [{"role": "system", "content": SYSTEM}]

    while True:
        try:
            user_input = input(f"{Colors.CYAN}>> {Colors.RESET}").strip()
        except (EOFError, KeyboardInterrupt):
            break

        if not user_input or user_input.lower() in ("exit", "quit", "q"):
            break

        history.append({"role": "user", "content": user_input})

        try:
            agent_loop(history)
        except Exception as e:
            print(f"Error: {e}")

        print()


if __name__ == "__main__":
    main()
