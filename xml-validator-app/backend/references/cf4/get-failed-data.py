import json
import pandas as pd
import os
import re

def collect_failed_entries(json_file):
    with open(json_file, 'r') as file:
        data = json.load(file)

    file_name = data.get("file", "unknown_file")
    failed_entries = data.get("failed", [])
    dtd_errors = data.get("dtdErrorLog", []) # Fetch DTD errors

    cleaned_failed_entries = []

    # Extract series number once to use for all entries in this file
    match = re.search(r"-V-(\d+)\.xml$", file_name)
    series_number = match.group(1) if match else None

    # 1. Process standard failed conditions
    for entry in failed_entries:
        new_entry = {
            "file": file_name,
            "series number": series_number,
            "xmlTree": entry.get("xmlTree"),
            "key": entry.get("key"),
            "value": entry.get("value"),
            "dtdErrorLog": None # Keep column empty for standard failed rules
        }

        # Rule columns
        for rule_entry in entry.get("appliedRules", []):
            rule_name = rule_entry.get("rule")
            violation_text = rule_entry.get("violation")

            if rule_name:
                new_entry[rule_name] = violation_text

        cleaned_failed_entries.append(new_entry)

    # 2. Process DTD Error Logs
    for error_msg in dtd_errors:
        dtd_entry = {
            "file": file_name,
            "series number": series_number,
            "xmlTree": None,
            "key": None,
            "value": None,
            "dtdErrorLog": error_msg # Populate the new column
        }
        cleaned_failed_entries.append(dtd_entry)

    return cleaned_failed_entries

# Main Execution
input_folder = 'results/failed'
output_folder = 'file-extracts'
output_file = os.path.join(output_folder, 'all_failed_entries.xlsx')

os.makedirs(output_folder, exist_ok=True)

print("Looking in folder:", input_folder)
try:
    print("Files found:", os.listdir(input_folder))
except FileNotFoundError:
    print(f"Error: The folder '{input_folder}' does not exist yet.")
    exit()

all_failed_entries = []

for json_file in os.listdir(input_folder):
    if json_file.endswith('.json'):
        print("Processing:", json_file)
        json_file_path = os.path.join(input_folder, json_file)
        all_failed_entries.extend(collect_failed_entries(json_file_path))

print("Total Entries Collected (Failed + DTD Errors):", len(all_failed_entries))

if all_failed_entries:
    df = pd.DataFrame(all_failed_entries)
    
    # Optional: Reorder columns to ensure 'dtdErrorLog' is near the front
    cols = df.columns.tolist()
    # Move dtdErrorLog to be right after 'value' if it exists
    if 'dtdErrorLog' in cols:
        cols.insert(5, cols.pop(cols.index('dtdErrorLog')))
        df = df[cols]
        
    df.to_excel(output_file, index=False)
    print(f"Saved Excel to: {output_file}")
else:
    print("No failed entries or DTD errors to save.")