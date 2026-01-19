#!/usr/bin/env python
import os
import sys
import json
import subprocess
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv(override=True)

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"), 
    base_url=os.environ.get("OPENAI_BASE_URL"),
    timeout=1800,
)

MODEL = os.environ.get("OPENAI_MODEL", "deepseek-v3-2-251201")
# TOOL = [{
#     "name": "bash",
#     "description": """Execute shell command. Common patterns:
# - Read: cat/head/tail, grep/find/rg/ls, wc -l
# - Write: echo 'content' > file, sed -i 's/old/new/g' file
# - Subagent: python v0_bash_agent.py 'task description' (spawns isolated agent, returns summary)""",
#     "input_schema": {
#         "type": "object",
#         "properties": {"command": {"type": "string"}},
#         "required": ["command"]
#     }
# }]
TOOL = [
    {
        "type": "function",
        "function": {
            "name": "bash",
            "description": """Execute shell command. Common patterns:
- Read: cat/head/tail, grep/find/rg/ls, wc -l
- Write: echo 'content' > file, sed -i 's/old/new/g' file
- Subagent: python v0_bash_agent.py 'task description' (spawns isolated agent, returns summary)""",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The shell command to execute"
                    }
                },
                "required": ["command"]
            },
        }
    }
]

SYSTEM = f"""You are a CLI agent at {os.getcwd()}. Solve problems using bash commands.

Rules:
- Prefer tools over prose. Act first, explain briefly after.
- Read files: cat, grep, find, rg, ls, head, tail
- Write files: echo '...' > file, sed -i, or cat << 'EOF' > file
- Subagent: For complex subtasks, spawn a subagent to keep context clean:
  python v0_bash_agent.py "explore src/ and summarize the architecture"

When to use subagent:
- Task requires reading many files (isolate the exploration)
- Task is independent and self-contained
- You want to avoid polluting current conversation with intermediate details

The subagent runs in isolation and returns only its final summary."""


def chat(prompt, history=None):
    if history is None:
        history = [{"role": "system", "content": SYSTEM}]

    history.append({"role": "user", "content": prompt})

    while True:
        completion = client.chat.completions.create(
            model=MODEL,
            messages=history,
            tools=TOOL,
            max_tokens=32 * 1024,
        )

        history.append(completion.choices[0].message.model_dump())

        resp_msg = completion.choices[0].message
        if completion.choices[0].finish_reason != "tool_calls":
            return resp_msg.content
        
        print(f"\033[32m{resp_msg.content}\033[0m")
        
        tool_calls = completion.choices[0].message.tool_calls
        for tool_call in tool_calls:
            tool_name = tool_call.function.name
            function_args = json.loads(tool_call.function.arguments)
            cmd = function_args.get("command")
            print(f"\033[33m$ {cmd}\033[0m")
            try:
                out = subprocess.run(
                    cmd,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=300,
                    cwd=os.getcwd()
                )
                output = out.stdout + out.stderr
            except subprocess.TimeoutExpired:
                output = "(timeout after 300s)"

            print(output or "(empty)")
            history.append(
                {"role": "tool", "content": output[:50000], "tool_call_id": tool_call.id}
            )


if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(chat(sys.argv[1]))
    else:
        history = []
        while True:
            try:
                query = input("\033[36m>> \033[0m")
            except (EOFError, KeyboardInterrupt):
                break
            if query in ("q", "exit", ""):
                break
            print(chat(query, history))
