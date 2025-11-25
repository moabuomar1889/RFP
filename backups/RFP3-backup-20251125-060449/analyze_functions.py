"""
Function Usage Analyzer for Google Apps Script Project
Analyzes all functions to determine if they are:
- Called from UI (google.script.run)
- Called from other server-side functions
- Called from triggers
- Unused
"""

import re
import json
from pathlib import Path
from collections import defaultdict

# Read all function names
with open('all_functions_names.txt', 'r', encoding='utf-8') as f:
    all_functions = [line.strip() for line in f if line.strip()]

print(f"Total functions found: {len(all_functions)}")

# Read UI-called functions
with open('potential_ui_calls.txt', 'r', encoding='utf-8') as f:
    ui_calls_raw = [line.strip() for line in f if line.strip()]

# Filter to only include actual function names from our list
ui_called = [f for f in ui_calls_raw if f in all_functions]
print(f"Functions called from UI: {len(ui_called)}")

# Read all .gs files and search for function calls
code_files = ['src/Code.gs', 'src/GroupsAndAccess.gs']
all_code = ""
for file_path in code_files:
    with open(file_path, 'r', encoding='utf-8') as f:
        all_code += f.read() + "\n"

# Find all function calls in server-side code
function_calls = defaultdict(set)  # {caller_function: {called_function1, called_function2, ...}}

current_function = None
for line in all_code.split('\n'):
    # Check if this is a function definition line
    func_def_match = re.match(r'^\s*function\s+([a-zA-Z0-9_]+)', line)
    if func_def_match:
        current_function = func_def_match.group(1)
    
    # Find all function calls in this line
    if current_function:
        for func in all_functions:
            # Match function calls: functionName( but not in comments
            if not line.strip().startswith('//') and not line.strip().startswith('*'):
                if re.search(rf'\b{re.escape(func)}\s*\(', line):
                    if func != current_function:  # Don't count recursive calls as usage
                        function_calls[current_function].add(func)

# Build a set of all called functions (from server-side)
server_called = set()
for caller, callees in function_calls.items():
    server_called.update(callees)

print(f"Functions called from server-side: {len(server_called)}")

# Special functions (triggers, entry points)
trigger_functions = {
    'doGet',  # Web app entry point
    'onOpen',  # Spreadsheet open trigger
    'onEdit',  # Edit trigger    
    'cronSyncRecent',  # Time-driven triggers
    'cronAuditAll',
    'scanDriveSnapshot',  # Might be time-driven
    'monitorAndDeleteBlockedFiles'  # Might be time-driven
}

# Functions that exist as triggers
actual_triggers = [f for f in trigger_functions if f in all_functions]
print(f"Trigger/Entry functions: {len(actual_triggers)}")

# Classify all functions
used_functions = set(ui_called) | server_called | set(actual_triggers)
unused_functions = [f for f in all_functions if f not in used_functions]

print(f"\nUnused functions: {len(unused_functions)}")

# Generate report
report = {
    'total_functions': len(all_functions),
    'ui_called': sorted(ui_called),
    'trigger_functions': sorted(actual_triggers),
    'server_called_only': sorted(server_called - set(ui_called) - set(actual_triggers)),
    'unused': sorted(unused_functions),
    'function_call_graph': {caller: sorted(list(callees)) for caller, callees in function_calls.items()}
}

# Save full report
with open('function_usage_report.json', 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=2, ensure_ascii=False)

# Create human-readable report
with open('function_usage_report.txt', 'w', encoding='utf-8') as f:
    f.write("=" * 80 + "\n")
    f.write("FUNCTION USAGE ANALYSIS REPORT\n")
    f.write("=" * 80 + "\n\n")
    
    f.write(f"Total Functions: {report['total_functions']}\n")
    f.write(f"UI-Called Functions: {len(report['ui_called'])}\n")
    f.write(f"Trigger/Entry Functions: {len(report['trigger_functions'])}\n")
    f.write(f"Server-Only Called Functions: {len(report['server_called_only'])}\n")
    f.write(f"UNUSED Functions: {len(report['unused'])}\n\n")
    
    f.write("=" * 80 + "\n")
    f.write("UI-CALLED FUNCTIONS (via google.script.run)\n")
    f.write("=" * 80 + "\n")
    for func in report['ui_called']:
        f.write(f"  - {func}\n")
    
    f.write("\n" + "=" * 80 + "\n")
    f.write("TRIGGER/ENTRY POINT FUNCTIONS\n")
    f.write("=" * 80 + "\n")
    for func in report['trigger_functions']:
        f.write(f"  - {func}\n")
    
    f.write("\n" + "=" * 80 + "\n")
    f.write("SERVER-SIDE ONLY FUNCTIONS (Called internally, not from UI)\n")
    f.write("=" * 80 + "\n")
    for func in report['server_called_only']:
        f.write(f"  - {func}\n")
    
    f.write("\n" + "=" * 80 + "\n")
    f.write("UNUSED FUNCTIONS (Safe to remove)\n")
    f.write("=" * 80 + "\n")
    for func in report['unused']:
        f.write(f"  - {func}\n")

print("\nReports saved:")
print("- function_usage_report.json (detailed)")
print("- function_usage_report.txt (human-readable)")
print("\nDone!")
