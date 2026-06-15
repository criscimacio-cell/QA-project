import os
import json
import shutil
from shutil import move
import time

# Function to check if the "failed" key is empty or if "dtdErrorLog" has errors
def check_for_errors(data):
    # Original condition: True if 'failed' is missing or has items
    failed_has_errors = not ("failed" in data and not data["failed"])
    
    # New condition: True if 'dtdErrorLog' exists and contains items
    dtd_has_errors = "dtdErrorLog" in data and bool(data["dtdErrorLog"])
    
    return failed_has_errors or dtd_has_errors

# Function to process JSON files in a folder and move files with failed condition
def process_folder(folder_path, failed_files):
    for filename in os.listdir(folder_path):
        file_path = os.path.join(folder_path, filename)
        if os.path.isfile(file_path) and filename.endswith(".json"):
            with open(file_path, 'r') as json_file:
                try:
                    data = json.load(json_file)
                    # Use the updated error checking function here
                    if check_for_errors(data):
                        failed_files.append(filename)
                        json_file.close()
                        destination_folder = os.path.join(folder_path, "..", "failed")
                        os.makedirs(destination_folder, exist_ok=True)
                        time.sleep(0.1)  # Add a small delay before moving the file
                        shutil.move(file_path, os.path.join(destination_folder, filename))
                except json.JSONDecodeError:
                    print(f"Error decoding JSON in file: {filename}")
                except PermissionError:
                    print(f"Permission error: {filename}")
                    time.sleep(0.5)  # Add a delay before retrying
                    try:
                        os.unlink(file_path)  # Attempt to remove the file
                    except Exception as e:
                        print(f"Error while removing file: {e}")

# Main function to iterate through folders in the 'results' directory
def main():
    results_folder = r"results"  # Change this to the actual folder name
    failed_files = []

    for folder in os.listdir(results_folder):
        folder_path = os.path.join(results_folder, folder)
        if os.path.isdir(folder_path):
            process_folder(folder_path, failed_files)

    # Print the list of files with the required condition
    if failed_files:
        print("Files with errors moved to 'failed' folder:")
        for file in failed_files:
            print(file)
    else:
        print("No errors were found.")

if __name__ == "__main__":
    main()