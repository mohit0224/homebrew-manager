#!/usr/bin/env python3
"""
Test suite to verify guardrail rules and behaviors.
"""

import os
import sys
import json

# Add parent and .agents/scripts to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".agents", "scripts")))
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

import guardrails
import guard

def test_guardrails():
    test_cases = [
        # (Name, payload, expected_decision, description)
        (
            "Allowed Git Status",
            {"toolCall": {"name": "run_command", "args": {"CommandLine": "git status"}}},
            "allow",
            "git status command should be allowed"
        ),
        (
            "Blocked Git Commit",
            {"toolCall": {"name": "run_command", "args": {"CommandLine": "git commit -m 'feat'"}}},
            "deny",
            "git commit should be blocked"
        ),
        (
            "Blocked Git Push",
            {"toolCall": {"name": "run_command", "args": {"CommandLine": "git push origin main"}}},
            "deny",
            "git push should be blocked"
        ),
        (
            "Blocked Git Add",
            {"toolCall": {"name": "run_command", "args": {"CommandLine": "git add ."}}},
            "deny",
            "git add should be blocked"
        ),
        (
            "Blocked Directory Traversal",
            {"toolCall": {"name": "run_command", "args": {"CommandLine": "cd .. && ls"}}},
            "deny",
            "Directory traversal outside project should be blocked"
        ),
        (
            "Blocked Outside Path TargetFile",
            {"toolCall": {"name": "write_to_file", "args": {"TargetFile": "/tmp/secret.txt"}}},
            "deny",
            "Access to /tmp should be blocked"
        ),
        (
            "Allowed Inside Path TargetFile",
            {"toolCall": {"name": "write_to_file", "args": {"TargetFile": os.path.join(guardrails.WORKSPACE_DIR, "sample.txt")}}},
            "allow",
            "Access to workspace file should be allowed"
        ),
        (
            "Gated File Deletion",
            {"toolCall": {"name": "run_command", "args": {"CommandLine": "rm -rf folder"}}},
            "force_ask",
            "File deletion should require user confirmation"
        ),
        (
            "Gated DB Deletion",
            {"toolCall": {"name": "run_command", "args": {"CommandLine": "DELETE FROM users WHERE id=1"}}},
            "force_ask",
            "Database deletion query should require user confirmation"
        ),
        (
            "Gated Network Tool",
            {"toolCall": {"name": "read_url_content", "args": {"Url": "https://example.com"}}},
            "force_ask",
            "read_url_content tool should require user confirmation"
        ),
        (
            "Gated Network Command",
            {"toolCall": {"name": "run_command", "args": {"CommandLine": "curl https://example.com"}}},
            "force_ask",
            "curl command should require user confirmation"
        ),
        (
            "Allowed Safe Command",
            {"toolCall": {"name": "run_command", "args": {"CommandLine": "ls -la"}}},
            "allow",
            "Safe directory listing should be allowed"
        ),
    ]

    print("Running Guardrail Test Suite...\n" + "="*50)
    all_passed = True
    results = []

    for name, payload, expected, desc in test_cases:
        res = guardrails.check_guardrails(payload)
        actual = res.get("decision")
        passed = (actual == expected)
        if not passed:
            all_passed = False
        status_str = "PASS" if passed else "FAIL"
        results.append((name, status_str, expected, actual, desc))
        print(f"[{status_str}] {name}: expected '{expected}', got '{actual}'")

    print("="*50)

    # Test standalone guard.py
    cmd_allowed, _ = guard.validate_command("git status")
    cmd_blocked, _ = guard.validate_command("git push")
    del_gated, _ = guard.validate_command("rm -rf old_files")
    net_gated, _ = guard.validate_command("curl http://api.com")

    assert cmd_allowed is True, "guard.py should allow git status"
    assert cmd_blocked is False, "guard.py should block git push"
    assert del_gated is False, "guard.py should require permission for rm"
    assert net_gated is False, "guard.py should require permission for curl"

    print("\nStandalone guard.py tests passed successfully.")

    if all_passed:
        print("\nAll 12 guardrail tests PASSED successfully!")
        return 0
    else:
        print("\nSome tests FAILED.")
        return 1

if __name__ == "__main__":
    sys.exit(test_guardrails())
