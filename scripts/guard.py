#!/usr/bin/env python3
"""
HomeBrew Manager Agent Guardrail Engine.
Validates commands, paths, and actions before execution.
Enforces security rules across all AI coding agents.
"""

import sys
import os
import re

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def validate_command(command_str):
    cmd_clean = command_str.strip().lower()

    # 1. Check Git commands
    if re.search(r"\bgit\b", cmd_clean):
        if not re.search(r"^\s*git\s+status(\s+.*)?$", cmd_clean):
            return False, "BLOCKED: Only 'git status' is allowed. Git write actions (commit, push, add) belong to the user."

    # 2. Check Deletion commands
    file_delete_patterns = [r"\brm\s+", r"\brmdir\s+", r"\bunlink\s+", r"\bdel\s+"]
    for pat in file_delete_patterns:
        if re.search(pat, cmd_clean):
            return False, "REQUIRES_USER_PERMISSION: File or directory deletion detected."

    # 3. Check Database Deletions
    db_patterns = [r"\bdrop\s+table\b", r"\bdrop\s+database\b", r"\bdelete\s+from\b", r"\btruncate\b"]
    for pat in db_patterns:
        if re.search(pat, cmd_clean):
            return False, "REQUIRES_USER_PERMISSION: Database deletion detected."

    # 4. Check Network requests
    net_patterns = [r"\bcurl\s+", r"\bwget\s+", r"\bssh\s+", r"\bscp\s+", r"\bftp\s+", r"\bping\s+", r"\bhttps?://"]
    for pat in net_patterns:
        if re.search(pat, cmd_clean):
            return False, "REQUIRES_USER_PERMISSION: Network call detected."

    # 5. Check directory escape
    traversal_patterns = [r"\bcd\s+\.\.", r"\bcd\s+/", r"\bcd\s+~"]
    for pat in traversal_patterns:
        if re.search(pat, cmd_clean):
            return False, "BLOCKED: Directory traversal outside project directory."

    return True, "ALLOWED"

def validate_path(path_str):
    abs_path = os.path.abspath(os.path.expanduser(path_str))
    if not abs_path.startswith(WORKSPACE_ROOT):
        return False, f"BLOCKED: Path {abs_path} is outside project root {WORKSPACE_ROOT}."
    return True, "ALLOWED"

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 guard.py <command>")
        sys.exit(1)

    cmd = " ".join(sys.argv[1:])
    allowed, msg = validate_command(cmd)
    print(msg)
    sys.exit(0 if allowed else 1)
