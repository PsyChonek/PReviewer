import tkinter as tk
from tkinter import scrolledtext, messagebox, filedialog
import os
import requests
import json
import subprocess
import threading

# --- Configuration for Ollama ---
OLLAMA_API_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "codellama" # CHANGE THIS to the model you downloaded (e.g., 'mistral', 'phi3:mini')

AI_PROMPT_TEMPLATE = """
You are an expert code reviewer. Analyze the following code changes (diff format).
Identify potential bugs, security vulnerabilities, performance issues, and suggest improvements
based on best practices. Focus on the *newly added or modified lines*.
Provide concise, actionable feedback. If no issues, state 'No major issues found.'.

Consider the context of a C# and SQL development environment.
The feedback should be formatted clearly, focusing on specific lines if possible.
---
Diff:
{diff}
---
Review:
"""

class AIPrReviewerApp:
    def __init__(self, master):
        self.master = master
        master.title("Local AI PR Reviewer")
        master.geometry("800x650") # Set initial window size

        # --- Frames for layout ---
        self.input_frame = tk.Frame(master, padx=10, pady=10)
        self.input_frame.pack(fill=tk.X)

        self.output_frame = tk.Frame(master, padx=10, pady=10)
        self.output_frame.pack(fill=tk.BOTH, expand=True)

        # --- Input Widgets ---
        tk.Label(self.input_frame, text="Repository Path:").grid(row=0, column=0, sticky=tk.W, pady=2)
        self.repo_path_entry = tk.Entry(self.input_frame, width=60)
        self.repo_path_entry.grid(row=0, column=1, padx=5, pady=2)
        tk.Button(self.input_frame, text="Browse...", command=self.browse_repo_path).grid(row=0, column=2, pady=2)

        tk.Label(self.input_frame, text="Base Branch:").grid(row=1, column=0, sticky=tk.W, pady=2)
        self.base_branch_entry = tk.Entry(self.input_frame, width=60)
        self.base_branch_entry.insert(0, "main") # Default base branch
        self.base_branch_entry.grid(row=1, column=1, padx=5, pady=2)

        self.review_button = tk.Button(self.input_frame, text="Start AI Review", command=self.start_review_thread)
        self.review_button.grid(row=2, column=0, columnspan=3, pady=10)

        self.status_label = tk.Label(self.input_frame, text="", fg="blue")
        self.status_label.grid(row=3, column=0, columnspan=3, sticky=tk.W)

        # --- Output Widget ---
        tk.Label(self.output_frame, text="AI Review Feedback:").pack(anchor=tk.W, pady=(10, 5))
        self.output_text = scrolledtext.ScrolledText(self.output_frame, wrap=tk.WORD, width=90, height=25, font=("Courier New", 10))
        self.output_text.pack(fill=tk.BOTH, expand=True)
        self.output_text.insert(tk.END, "Enter repository path and base branch, then click 'Start AI Review'.\n")
        self.output_text.insert(tk.END, "Ensure Ollama is running and your chosen model ('codellama', 'mistral', etc.) is downloaded.\n")
        self.output_text.insert(tk.END, f"Ollama API URL: {OLLAMA_API_URL}\n")
        self.output_text.insert(tk.END, f"Ollama Model: {OLLAMA_MODEL}\n")

    def browse_repo_path(self):
        """Allows user to select a directory for the repository path."""
        directory = filedialog.askdirectory()
        if directory:
            self.repo_path_entry.delete(0, tk.END)
            self.repo_path_entry.insert(0, directory)

    def update_status(self, message, color="blue"):
        """Updates the status label."""
        self.status_label.config(text=message, fg=color)
        self.master.update_idletasks() # Refresh GUI immediately

    def start_review_thread(self):
        """Starts the review process in a separate thread to keep the GUI responsive."""
        repo_path = self.repo_path_entry.get()
        base_branch = self.base_branch_entry.get()

        if not repo_path:
            messagebox.showerror("Input Error", "Please provide a repository path.")
            return

        if not os.path.isdir(repo_path):
            messagebox.showerror("Input Error", "The provided repository path does not exist or is not a directory.")
            return
            
        # Basic check if it looks like a Git repo
        if not os.path.isdir(os.path.join(repo_path, ".git")):
            messagebox.showerror("Input Error", "The provided path does not appear to be a Git repository.")
            return

        self.output_text.delete(1.0, tk.END)
        self.update_status("Processing...", "blue")
        self.review_button.config(state=tk.DISABLED) # Disable button during processing

        # Start the heavy lifting in a new thread
        threading.Thread(target=self._run_review, args=(repo_path, base_branch)).start()

    def _run_review(self, repo_path, base_branch):
        """Contains the core logic for Git diff and Ollama API call."""
        original_cwd = os.getcwd() # Store original current working directory
        try:
            os.chdir(repo_path) # Change to repository directory

            self.update_status(f"Generating diff for '{repo_path}' against '{base_branch}'...", "blue")
            pr_diff = self._get_git_diff(base_branch, "HEAD")

            if not pr_diff:
                self.output_text.insert(tk.END, "No diff generated or found. Ensure you are on a branch with changes to review.\n")
                self.update_status("Review Finished (No Diff)", "orange")
                return

            self.output_text.insert(tk.END, "Diff generated. Sending to local AI model...\n")
            self.update_status("Calling local Ollama model...", "blue")
            
            prompt = AI_PROMPT_TEMPLATE.format(diff=pr_diff)
            ai_feedback = self._call_ollama_api(prompt)

            self.output_text.insert(tk.END, "\n--- AI Review Results ---\n")
            if ai_feedback:
                self.output_text.insert(tk.END, ai_feedback)
                self.update_status("Review Complete", "green")
            else:
                self.output_text.insert(tk.END, "AI review failed to generate feedback.\n")
                self.update_status("Review Failed", "red")

        except Exception as e:
            self.output_text.insert(tk.END, f"\nAn unexpected error occurred: {e}\n")
            self.update_status("An Error Occurred", "red")
        finally:
            os.chdir(original_cwd) # Change back to original directory
            self.review_button.config(state=tk.NORMAL) # Re-enable button

    def _get_git_diff(self, base_branch, target_commit="HEAD"):
        """
        Generates the git diff between the target_commit and the specified base_branch.
        Assumes the script is run within a Git repository.
        """
        try:
            # Ensure the base branch is fetched
            self.update_status(f"Fetching origin/{base_branch}...", "blue")
            subprocess.run(["git", "fetch", "origin", base_branch], check=True, capture_output=True, text=True, encoding='utf-8')
            
            # Find the merge base (common ancestor)
            merge_base_cmd = ["git", "merge-base", f"origin/{base_branch}", target_commit]
            merge_base_result = subprocess.run(merge_base_cmd, check=True, capture_output=True, text=True, encoding='utf-8')
            merge_base_commit = merge_base_result.stdout.strip()

            diff_command = ["git", "diff", "--no-prefix", "-U3", merge_base_commit, target_commit]
            result = subprocess.run(diff_command, check=True, capture_output=True, text=True, encoding='utf-8', errors='ignore')
            diff_output = result.stdout.strip()
            
            return diff_output
        except subprocess.CalledProcessError as e:
            self.output_text.insert(tk.END, f"Error executing git command: {e.cmd}\n")
            self.output_text.insert(tk.END, f"Stdout: {e.stdout}\n")
            self.output_text.insert(tk.END, f"Stderr: {e.stderr}\n")
            return None
        except Exception as e:
            self.output_text.insert(tk.END, f"Error getting diff: {e}\n")
            return None

    def _call_ollama_api(self, prompt_text):
        """Sends the prompt to the local Ollama API."""
        try:
            response = requests.post(OLLAMA_API_URL, json={
                "model": OLLAMA_MODEL,
                "prompt": prompt_text,
                "stream": False
            }, timeout=600)
            response.raise_for_status()
            return response.json()['response']
        except requests.exceptions.ConnectionError:
            self.output_text.insert(tk.END, f"Error: Could not connect to Ollama at {OLLAMA_API_URL}.\n")
            self.output_text.insert(tk.END, "Please ensure Ollama is installed and running, and the model ('codellama' or your chosen model) has been downloaded.\n")
            self.output_text.insert(tk.END, "You can start Ollama and download the model by running 'ollama run <model_name>' in your terminal.\n")
            return None
        except requests.exceptions.RequestException as e:
            self.output_text.insert(tk.END, f"Error calling Ollama API: {e}\n")
            if e.response:
                self.output_text.insert(tk.END, f"API Response: {e.response.text}\n")
            return None

# --- Main application execution ---
if __name__ == "__main__":
    root = tk.Tk()
    app = AIPrReviewerApp(root)
    root.mainloop()