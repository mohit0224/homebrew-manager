#!/usr/bin/env python3
import sys
import json
import re
import os

WORKSPACE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

def check_guardrails(payload):
    tool_call = payload.get("toolCall", {})
    name = tool_call.get("name", "")
    args = tool_call.get("args", {})

    # 1. Network Calls Guardrail
    network_tools = {"read_url_content", "search_web", "read_browser_page", "browser_subagent"}
    if name in network_tools:
        return {
            "decision": "force_ask",
            "reason": f"Network call detected via {name}. Explicit user permission is required."
        }

    # 2. Path and Directory Boundary Guardrail
    GLOBAL_SKILLS_DIR = os.path.abspath(os.path.expanduser("~/.gemini/config/skills"))
    BUILTIN_SKILLS_DIR = os.path.abspath(os.path.expanduser("~/.gemini/antigravity-ide/builtin/skills"))

    # Write tools must strictly stay in workspace
    write_tools = {"write_to_file", "replace_file_content", "multi_replace_file_content"}
    if name in write_tools:
        target = os.path.abspath(os.path.expanduser(args.get("TargetFile", "")))
        if not target.startswith(WORKSPACE_DIR):
            return {
                "decision": "deny",
                "reason": f"File write outside workspace boundary is blocked: {target}"
            }

    # Read tools can view workspace files or installed skills
    read_tools = {"view_file", "list_dir", "grep_search"}
    if name in read_tools:
        for path_arg in ["AbsolutePath", "DirectoryPath", "SearchPath"]:
            if path_arg in args and isinstance(args[path_arg], str):
                target_path = os.path.abspath(os.path.expanduser(args[path_arg]))
                allowed = (
                    target_path.startswith(WORKSPACE_DIR) or
                    target_path.startswith(GLOBAL_SKILLS_DIR) or
                    target_path.startswith(BUILTIN_SKILLS_DIR)
                )
                if not allowed:
                    return {
                        "decision": "deny",
                        "reason": f"Access outside project boundary is blocked: {target_path}"
                    }


    # 3. Command Line Guardrails (for run_command)
    if name == "run_command":
        if "Cwd" in args and isinstance(args["Cwd"], str):
            cwd = os.path.abspath(os.path.expanduser(args["Cwd"]))
            if not cwd.startswith(WORKSPACE_DIR):
                return {
                    "decision": "deny",
                    "reason": f"Execution outside workspace directory is blocked: {cwd}"
                }

        cmd = args.get("CommandLine", "").strip()
        cmd_lower = cmd.lower()

        # 3a. Git Command Guardrail
        git_pattern = r"\bgit\b"
        if re.search(git_pattern, cmd_lower):
            # Check if it is purely a git status command
            status_match = re.search(r"^\s*git\s+status(\s+.*)?$", cmd_lower)
            if status_match:
                # Allowed
                pass
            else:
                return {
                    "decision": "deny",
                    "reason": "Git write operations (e.g. git add, git commit, git push) are blocked. Only 'git status' is allowed."
                }

        # 3b. Deletion Guardrail (Files, folders, DB)
        file_delete_patterns = [
            r"\brm\s+",
            r"\brmdir\s+",
            r"\bunlink\s+",
            r"\bshutil\.rmtree\b",
            r"\bdel\s+"
        ]
        for pat in file_delete_patterns:
            if re.search(pat, cmd_lower):
                return {
                    "decision": "force_ask",
                    "reason": "File or folder deletion command detected. Explicit user permission is required."
                }

        db_delete_patterns = [
            r"\bdrop\s+table\b",
            r"\bdrop\s+database\b",
            r"\bdrop\s+schema\b",
            r"\bdelete\s+from\b",
            r"\btruncate\s+table\b",
            r"\btruncate\b"
        ]
        for pat in db_delete_patterns:
            if re.search(pat, cmd_lower):
                return {
                    "decision": "force_ask",
                    "reason": "Database deletion query detected. Explicit user permission is required."
                }

        # 3c. Network Commands Guardrail in run_command
        network_cmd_patterns = [
            r"\bcurl\s+",
            r"\bwget\s+",
            r"\bssh\s+",
            r"\bscp\s+",
            r"\bftp\s+",
            r"\bnc\s+",
            r"\btelnet\s+",
            r"\bping\s+",
            r"\bhttp://",
            r"\bhttps://"
        ]
        for pat in network_cmd_patterns:
            if re.search(pat, cmd_lower):
                return {
                    "decision": "force_ask",
                    "reason": "Outbound network command detected. Explicit user permission is required."
                }

        # 3d. Directory Traversal Guardrail in run_command
        traversal_patterns = [
            r"\bcd\s+\.\.",
            r"\bcd\s+/",
            r"\bcd\s+~"
        ]
        for pat in traversal_patterns:
            if re.search(pat, cmd_lower):
                return {
                    "decision": "deny",
                    "reason": "Directory traversal outside the workspace is blocked."
                }

    return {"decision": "allow"}

def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"decision": "allow"}))
            return

        payload = json.loads(raw_input)
        result = check_guardrails(payload)
        print(json.dumps(result))
    except Exception as e:
        # On error, default to asking user for safety
        print(json.dumps({
            "decision": "ask",
            "reason": f"Guardrail error encountered: {str(e)}"
        }))

if __name__ == "__main__":
    main()
