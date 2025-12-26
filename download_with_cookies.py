import subprocess
import os
from pathlib import Path
import sys

# --- Configuration ---
VIDEO_URL = "https://m.youtube.com/watch?v=bVQ95AUqMUw"
# Based on our investigation, this is the path where Deno was installed.
DENO_PATH = Path.home() / ".deno" / "bin" / "deno"
COOKIES_FILE = "cookies.txt"
# We will try format 299 (1080p50 MP4) as it's a high-quality option.
FORMAT_ID = "299"
OUTPUT_FILENAME = "downloaded_video_1080p.mp4"

def main():
    """
    Main function to check for cookies and run the yt-dlp download command.
    """
    print("--- YouTube Video Downloader Script ---")

    # 1. Check if the cookies.txt file exists
    if not os.path.exists(COOKIES_FILE):
        print(f"\n[ERROR] Cookies file not found: '{COOKIES_FILE}'")
        print("\nPlease place a valid 'cookies.txt' file in the same directory as this script.")
        print("You can get this file using a browser extension like 'Get cookies.txt' or 'EditThisCookie'.")
        sys.exit(1)

    print(f"\n[INFO] Found '{COOKIES_FILE}'.")

    # 2. Check if the Deno runtime exists at the expected path
    deno_path_str = str(DENO_PATH)
    js_runtime_arg = []
    if not DENO_PATH.exists():
        print(f"\n[WARNING] Deno runtime not found at the expected path: {deno_path_str}")
        print("The script will try to run yt-dlp without it, but may fail.")
    else:
        print(f"[INFO] Found Deno runtime at: {deno_path_str}")
        js_runtime_arg = ["--js-runtimes", f"deno:{deno_path_str}"]

    # 3. Construct the full yt-dlp command
    command = [
        "yt-dlp",
        "--cookies", COOKIES_FILE,
        "-f", FORMAT_ID,
        "-o", OUTPUT_FILENAME,
    ]
    command.extend(js_runtime_arg)
    command.append(VIDEO_URL)

    print("\n[INFO] Assembling the following command:")
    try:
        import shlex
        print(" ".join(shlex.quote(str(arg)) for arg in command))
    except ImportError:
        print(" ".join(f"'{str(arg)}'" for arg in command))

    # 4. Execute the command and stream output
    print("\n[INFO] Starting download... This may take a while.")
    print("-" * 40)

    try:
        # Use Popen to stream output in real-time
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, # Redirect stderr to stdout
            text=True,
            encoding='utf-8',
            bufsize=1 # Line-buffered
        )

        # Read and print the output line by line
        for line in iter(process.stdout.readline, ''):
            print(line, end='')

        process.stdout.close()
        return_code = process.wait()

        print("-" * 40)
        if return_code != 0:
            print(f"\n[ERROR] yt-dlp process finished with a non-zero exit code: {return_code}")
            print("Please check the output above for error messages from yt-dlp.")
        else:
            print(f"\n[SUCCESS] Download process completed. Video should be saved as '{OUTPUT_FILENAME}'")

    except FileNotFoundError:
        print("\n[FATAL ERROR] 'yt-dlp' command not found.")
        print("Please ensure yt-dlp is installed and accessible in your system's PATH.")
        sys.exit(1)
    except Exception as e:
        print(f"\n[FATAL ERROR] An unexpected error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
