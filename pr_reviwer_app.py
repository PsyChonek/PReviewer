import tkinter as tk
from tkinter import scrolledtext, messagebox, filedialog, ttk
import os
import requests
import json
import subprocess
import threading

class ModernButton(tk.Frame):
    """A custom button widget with modern styling and animations."""
    
    def __init__(self, parent, text="", command=None, bg_color="#007AFF", 
                 hover_color="#0051D0", active_color="#003D82", text_color="white",
                 font=("system", 10, "bold"), width=120, height=40, **kwargs):
        super().__init__(parent, **kwargs)
        
        self.command = command
        self.bg_color = bg_color
        self.hover_color = hover_color
        self.active_color = active_color
        self.text_color = text_color
        self.is_disabled = False
        self.disabled_bg = "#E5E5EA"
        self.disabled_fg = "#8E8E93"
        
        # Configure the frame
        try:
            parent_bg = parent.cget('bg')
        except:
            parent_bg = '#f6f8fa'
        self.configure(bg=parent_bg)
        
        # Create the button canvas for rounded corners
        self.canvas = tk.Canvas(self, width=width, height=height, highlightthickness=0, 
                               bg=parent_bg)
        self.canvas.pack()
        
        # Create rounded rectangle
        self._create_rounded_rect(2, 2, width-2, height-2, radius=8, fill=bg_color, outline="")
        
        # Create text label
        self.text_id = self.canvas.create_text(width//2, height//2, text=text, 
                                              fill=text_color, font=font, anchor="center")
        
        # Bind events
        self.canvas.bind("<Button-1>", self._on_click)
        self.canvas.bind("<Enter>", self._on_enter) 
        self.canvas.bind("<Leave>", self._on_leave)
        
        # Make the frame non-focusable
        self.canvas.configure(cursor="hand2")
        
    def _create_rounded_rect(self, x1, y1, x2, y2, radius=25, **kwargs):
        """Create a rounded rectangle with subtle shadow effect on the canvas."""
        points = []
        for x, y in [(x1, y1 + radius), (x1, y1), (x1 + radius, y1),
                     (x2 - radius, y1), (x2, y1), (x2, y1 + radius),
                     (x2, y2 - radius), (x2, y2), (x2 - radius, y2),
                     (x1 + radius, y2), (x1, y2), (x1, y2 - radius)]:
            points.extend([x, y])
        
        # Create a subtle shadow effect using gray color
        shadow_points = [p + 1 if i % 2 == 0 else p + 1 for i, p in enumerate(points)]
        self.canvas.create_polygon(shadow_points, smooth=True, fill='#D0D0D0', outline="")
        
        # Create the main button
        self.rect_id = self.canvas.create_polygon(points, smooth=True, **kwargs)
        return self.rect_id
        
    def _on_click(self, event):
        """Handle button click."""
        if not self.is_disabled and self.command:
            self.command()
            
    def _on_enter(self, event):
        """Handle mouse enter."""
        if not self.is_disabled:
            self.canvas.itemconfig(self.rect_id, fill=self.hover_color)
            
    def _on_leave(self, event):
        """Handle mouse leave."""
        if not self.is_disabled:
            self.canvas.itemconfig(self.rect_id, fill=self.bg_color)
    
    def config_state(self, state):
        """Configure button state (normal/disabled)."""
        if state == tk.DISABLED or state == "disabled":
            self.is_disabled = True
            self.canvas.itemconfig(self.rect_id, fill=self.disabled_bg)
            self.canvas.itemconfig(self.text_id, fill=self.disabled_fg)
            self.canvas.configure(cursor="")
        else:
            self.is_disabled = False
            self.canvas.itemconfig(self.rect_id, fill=self.bg_color)
            self.canvas.itemconfig(self.text_id, fill=self.text_color)
            self.canvas.configure(cursor="hand2")
    
    def set_text(self, text):
        """Update button text."""
        self.canvas.itemconfig(self.text_id, text=text)

# --- Configuration for Ollama ---
OLLAMA_API_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "codellama" # CHANGE THIS to the model you downloaded (e.g., 'mistral', 'phi3:mini')

def setup_ttk_styles():
    """Configure ttk styles for minimal appearance"""
    style = ttk.Style()
    
    # Try different themes for better macOS compatibility
    available_themes = style.theme_names()
    if 'aqua' in available_themes:
        style.theme_use('aqua')
    elif 'clam' in available_themes:
        style.theme_use('clam')
    
    # Configure combobox and its dropdown
    style.configure('Custom.TCombobox',
                   fieldbackground='#ffffff',
                   background='#ffffff',
                   foreground='#24292e',
                   borderwidth=0,
                   relief='flat',
                   selectbackground='#0366d6',
                   selectforeground='white',
                   arrowcolor='#586069',
                   insertcolor='#24292e')
    
    # Configure the dropdown list specifically
    style.configure('Custom.TCombobox.Listbox',
                   background='#ffffff',
                   foreground='#24292e',
                   selectbackground='#0366d6',
                   selectforeground='white',
                   borderwidth=1,
                   relief='solid')
    
    style.map('Custom.TCombobox',
             fieldbackground=[('readonly', '#ffffff'),
                            ('focus', '#ffffff'),
                            ('!disabled', '#ffffff'),
                            ('disabled', '#f6f8fa')],
             foreground=[('readonly', '#24292e'),
                        ('disabled', '#6a737d')],
             background=[('readonly', '#ffffff'),
                        ('!disabled', '#ffffff')])

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
        master.geometry("900x750")  # Increased window size for better layout
        master.configure(bg='#f6f8fa')  # Light GitHub-like background
        
        # Configure global options for better styling
        master.option_add('*TCombobox*Listbox.selectBackground', '#0366d6')
        master.option_add('*TCombobox*Listbox.selectForeground', 'white')
        master.option_add('*TCombobox*Listbox.background', '#ffffff')
        master.option_add('*TCombobox*Listbox.foreground', '#24292e')
        
        # Setup ttk styles
        setup_ttk_styles()

        # --- Main container with padding ---
        main_frame = tk.Frame(master, padx=15, pady=15, bg='#f6f8fa')
        main_frame.pack(fill=tk.BOTH, expand=True)

        # --- Configuration Frame ---
        config_frame = tk.LabelFrame(main_frame, text="Configuration", padx=12, pady=12,
                                   bg='#ffffff', fg='#24292e', font=('Arial', 11, 'bold'),
                                   relief='flat', bd=0)
        config_frame.pack(fill=tk.X, pady=(0, 10))
        
        # Configure grid weights for better alignment
        config_frame.grid_columnconfigure(1, weight=1)

        # OLLAMA Configuration
        tk.Label(config_frame, text="Ollama URL:", width=15, anchor='w', bg='#ffffff', fg='#586069', 
                font=('Arial', 10)).grid(row=0, column=0, sticky=tk.W, pady=2)
        self.ollama_url_entry = tk.Entry(config_frame, width=40, font=('Arial', 10),
                                       bg='#fafbfc', fg='#24292e', relief='flat', bd=2,
                                       highlightbackground='#d1d5da', highlightcolor='#0366d6', highlightthickness=1)
        self.ollama_url_entry.insert(0, OLLAMA_API_URL)
        self.ollama_url_entry.grid(row=0, column=1, sticky=tk.EW, padx=(5, 5), pady=2)

        tk.Label(config_frame, text="Ollama Model:", width=15, anchor='w', bg='#ffffff', fg='#586069',
                font=('Arial', 10)).grid(row=1, column=0, sticky=tk.W, pady=2)
        self.ollama_model_entry = tk.Entry(config_frame, width=40, font=('Arial', 10),
                                         bg='#fafbfc', fg='#24292e', relief='flat', bd=2,
                                         highlightbackground='#d1d5da', highlightcolor='#0366d6', highlightthickness=1)
        self.ollama_model_entry.insert(0, OLLAMA_MODEL)
        self.ollama_model_entry.grid(row=1, column=1, sticky=tk.EW, padx=(5, 5), pady=2)

        # --- Repository Frame ---
        repo_frame = tk.LabelFrame(main_frame, text="Repository & Branches", padx=12, pady=12,
                                 bg='#ffffff', fg='#24292e', font=('Arial', 11, 'bold'),
                                 relief='flat', bd=0)
        repo_frame.pack(fill=tk.X, pady=(0, 10))
        
        # Configure grid weights
        repo_frame.grid_columnconfigure(1, weight=1)

        # Repository Path
        tk.Label(repo_frame, text="Repository Path:", width=15, anchor='w', bg='#ffffff', fg='#586069',
                font=('Arial', 10)).grid(row=0, column=0, sticky=tk.W, pady=2)
        self.repo_path_entry = tk.Entry(repo_frame, width=50, font=('Arial', 10),
                                       bg='#fafbfc', fg='#24292e', relief='flat', bd=2,
                                       highlightbackground='#d1d5da', highlightcolor='#0366d6', highlightthickness=1)
        self.repo_path_entry.grid(row=0, column=1, sticky=tk.EW, padx=(5, 5), pady=2)
        
        # Create modern browse button
        self.browse_btn = ModernButton(repo_frame, text="📁 Browse", 
                                     command=self.browse_repo_path,
                                     bg_color="#007AFF", hover_color="#0051D0", 
                                     active_color="#003D82", text_color="white",
                                     font=("system", 10, "bold"),
                                     width=100, height=32, bg='#ffffff')
        self.browse_btn.grid(row=0, column=2, padx=(8, 0), pady=2)

        # From Branch (Base)
        tk.Label(repo_frame, text="From Branch:", width=15, anchor='w', bg='#ffffff', fg='#586069',
                font=('Arial', 10)).grid(row=1, column=0, sticky=tk.W, pady=2)
        
        self.base_branch_var = tk.StringVar(value="Select repository first...")
        self.base_branch_entry = tk.OptionMenu(repo_frame, self.base_branch_var, "Select repository first...")
        self.base_branch_entry.configure(bg='#fafbfc', fg='#24292e', relief='flat', bd=1,
                                        font=('Arial', 10), highlightthickness=0,
                                        activebackground='#e1e4e8', activeforeground='#24292e',
                                        highlightbackground='#d1d5da', highlightcolor='#0366d6')
        self.base_branch_entry.grid(row=1, column=1, sticky=tk.EW, padx=(5, 5), pady=2)
        
        # Configure the dropdown menu
        base_menu = self.base_branch_entry['menu']
        base_menu.configure(bg='#ffffff', fg='#24292e', activebackground='#0366d6',
                          activeforeground='white', relief='flat', bd=1)
        
        # Create modern refresh button
        self.refresh_btn = ModernButton(repo_frame, text="🔄 Refresh", 
                                      command=self.refresh_branches,
                                      bg_color="#34C759", hover_color="#248A3D", 
                                      active_color="#1B6B2F", text_color="white",
                                      font=("system", 10, "bold"),
                                      width=100, height=32, bg='#ffffff')
        self.refresh_btn.grid(row=1, column=2, padx=(8, 0), pady=2)
        self.refresh_btn.config_state(tk.DISABLED)  # Disabled until repo is selected

        # To Branch (Target)
        tk.Label(repo_frame, text="To Branch:", width=15, anchor='w', bg='#ffffff', fg='#586069',
                font=('Arial', 10)).grid(row=2, column=0, sticky=tk.W, pady=2)
        
        self.target_branch_var = tk.StringVar(value="Select repository first...")
        self.target_branch_entry = tk.OptionMenu(repo_frame, self.target_branch_var, "Select repository first...")
        self.target_branch_entry.configure(bg='#fafbfc', fg='#24292e', relief='flat', bd=1,
                                          font=('Arial', 10), highlightthickness=0,
                                          activebackground='#e1e4e8', activeforeground='#24292e',
                                          highlightbackground='#d1d5da', highlightcolor='#0366d6')
        self.target_branch_entry.grid(row=2, column=1, sticky=tk.EW, padx=(5, 5), pady=2)
        
        # Configure the dropdown menu
        target_menu = self.target_branch_entry['menu']
        target_menu.configure(bg='#ffffff', fg='#24292e', activebackground='#0366d6',
                            activeforeground='white', relief='flat', bd=1)

        # Apply additional combobox styling after creation (no longer needed with OptionMenu)
        # self._configure_combobox_styling()

        # --- Control Frame ---
        control_frame = tk.Frame(main_frame, bg='#f6f8fa')
        control_frame.pack(fill=tk.X, pady=(10, 15))

        # Create a modern styled main action button using custom class
        button_frame = tk.Frame(control_frame, bg='#f6f8fa')
        button_frame.pack(pady=15)
        
        self.review_button = ModernButton(button_frame, text="🚀 Start AI Review", 
                                        command=self.start_review_thread,
                                        bg_color="#FF3B30", hover_color="#D70015", 
                                        active_color="#B8000F", text_color="white",
                                        font=("system", 14, "bold"),
                                        width=200, height=50, bg='#f6f8fa')
        self.review_button.pack()
        self.review_button.config_state(tk.DISABLED)  # Disabled until branches are selected

        # Status frame with better styling
        status_frame = tk.Frame(control_frame, bg='#f6f8fa')
        status_frame.pack(fill=tk.X, pady=(5, 0))
        
        self.status_label = tk.Label(status_frame, text="Select a repository to begin...", fg="#586069", 
                                   font=('Arial', 10), bg='#f6f8fa', anchor='center')
        self.status_label.pack(pady=2)

        # --- Output Frame ---
        output_frame = tk.LabelFrame(main_frame, text="AI Review Output", padx=0, pady=0, 
                                   font=('Arial', 11, 'bold'), fg='#24292e', bg='#ffffff',
                                   relief='flat', bd=0)
        output_frame.pack(fill=tk.BOTH, expand=True, pady=(5, 0))
        
        # Create output controls toolbar
        self._create_output_toolbar(output_frame)
        
        # Create a frame to hold the text widget with improved styling
        text_container = tk.Frame(output_frame, bg='#ffffff', relief='flat', bd=0)
        text_container.pack(fill=tk.BOTH, expand=True, padx=12, pady=(0, 12))
        
        # Create the main text output area with better styling
        self.output_text = scrolledtext.ScrolledText(text_container, wrap=tk.WORD, width=90, height=25, 
                                                   font=("SF Mono", 11) if tk.TkVersion >= 8.5 else ("Monaco", 11), 
                                                   bg='#f8f9fa', fg='#24292e',
                                                   selectbackground='#0366d6', selectforeground='white',
                                                   insertbackground='#0366d6', relief='solid', bd=1,
                                                   padx=16, pady=12, highlightthickness=0,
                                                   borderwidth=1, highlightcolor='#0366d6',
                                                   highlightbackground='#e1e4e8')
        self.output_text.pack(fill=tk.BOTH, expand=True)
        
        # Configure text tags for syntax highlighting and better formatting
        self._setup_text_tags()
        
        # Add context menu
        self._setup_context_menu()
        
        # Progress indicator
        self.progress_frame = tk.Frame(text_container, bg='#f8f9fa', height=4)
        self.progress_bar = tk.Frame(self.progress_frame, bg='#0366d6', height=4)
        
        # Initial welcome message
        self.show_welcome_message()

    def _create_output_toolbar(self, parent):
        """Create a toolbar with output controls."""
        toolbar_frame = tk.Frame(parent, bg='#ffffff', height=50)
        toolbar_frame.pack(fill=tk.X, padx=12, pady=(12, 8))
        toolbar_frame.pack_propagate(False)
        
        # Left side - action buttons
        left_frame = tk.Frame(toolbar_frame, bg='#ffffff')
        left_frame.pack(side=tk.LEFT, fill=tk.Y)
        
        # Clear button
        self.clear_btn = ModernButton(left_frame, text="🗑️ Clear", 
                                    command=self.clear_output,
                                    bg_color="#FF3B30", hover_color="#D70015", 
                                    active_color="#B8000F", text_color="white",
                                    font=("system", 9, "bold"),
                                    width=80, height=28, bg='#ffffff')
        self.clear_btn.pack(side=tk.LEFT, padx=(0, 8))
        
        # Copy button
        self.copy_btn = ModernButton(left_frame, text="📋 Copy", 
                                   command=self.copy_output,
                                   bg_color="#007AFF", hover_color="#0051D0", 
                                   active_color="#003D82", text_color="white",
                                   font=("system", 9, "bold"),
                                   width=80, height=28, bg='#ffffff')
        self.copy_btn.pack(side=tk.LEFT, padx=(0, 8))
        
        # Export button
        self.export_btn = ModernButton(left_frame, text="💾 Export", 
                                     command=self.export_output,
                                     bg_color="#34C759", hover_color="#248A3D", 
                                     active_color="#1B6B2F", text_color="white",
                                     font=("system", 9, "bold"),
                                     width=80, height=28, bg='#ffffff')
        self.export_btn.pack(side=tk.LEFT, padx=(0, 8))
        
        # Right side - status indicator
        right_frame = tk.Frame(toolbar_frame, bg='#ffffff')
        right_frame.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.output_status = tk.Label(right_frame, text="Ready", fg="#34C759", 
                                    font=('Arial', 9, 'bold'), bg='#ffffff')
        self.output_status.pack(side=tk.RIGHT, pady=4)
    
    def _setup_text_tags(self):
        """Setup text tags for syntax highlighting and formatting."""
        # Header styles
        self.output_text.tag_configure("header1", font=("system", 14, "bold"), 
                                     foreground="#1f2937", spacing1=10, spacing3=5)
        self.output_text.tag_configure("header2", font=("system", 12, "bold"), 
                                     foreground="#374151", spacing1=8, spacing3=4)
        
        # Content styles
        self.output_text.tag_configure("info", foreground="#0366d6", font=("system", 10))
        self.output_text.tag_configure("success", foreground="#28a745", font=("system", 10, "bold"))
        self.output_text.tag_configure("warning", foreground="#f66a0a", font=("system", 10, "bold"))
        self.output_text.tag_configure("error", foreground="#d73a49", font=("system", 10, "bold"))
        
        # Code and diff styles
        self.output_text.tag_configure("code", font=("SF Mono", 10) if tk.TkVersion >= 8.5 else ("Monaco", 10), 
                                     background="#f6f8fa", relief="solid", borderwidth=1)
        self.output_text.tag_configure("diff_add", foreground="#22863a", background="#f0fff4")
        self.output_text.tag_configure("diff_remove", foreground="#d73a49", background="#ffeef0")
        self.output_text.tag_configure("diff_header", foreground="#6f42c1", font=("system", 10, "bold"))
        
        # Section separator
        self.output_text.tag_configure("separator", foreground="#d1d5da", font=("system", 10))
        
        # AI feedback specific styles
        self.output_text.tag_configure("ai_title", font=("system", 13, "bold"), 
                                     foreground="#6f42c1", spacing1=8, spacing3=4)
        self.output_text.tag_configure("feedback_item", foreground="#24292e", font=("system", 10), 
                                     lmargin1=20, lmargin2=20, spacing1=2)
    
    def _setup_context_menu(self):
        """Setup right-click context menu for the output text."""
        self.context_menu = tk.Menu(self.output_text, tearoff=0, bg='#ffffff', fg='#24292e',
                                  activebackground='#0366d6', activeforeground='white',
                                  relief='flat', bd=1)
        self.context_menu.add_command(label="Copy All", command=self.copy_output)
        self.context_menu.add_command(label="Copy Selection", command=self.copy_selection)
        self.context_menu.add_separator()
        self.context_menu.add_command(label="Clear Output", command=self.clear_output)
        self.context_menu.add_separator()
        self.context_menu.add_command(label="Export to File", command=self.export_output)
        
        def show_context_menu(event):
            try:
                self.context_menu.tk_popup(event.x_root, event.y_root)
            finally:
                self.context_menu.grab_release()
        
        self.output_text.bind("<Button-2>", show_context_menu)  # Right-click on macOS
        self.output_text.bind("<Control-Button-1>", show_context_menu)  # Control-click fallback
    
    def clear_output(self):
        """Clear the output text area."""
        self.output_text.config(state=tk.NORMAL)
        self.output_text.delete(1.0, tk.END)
        self.show_welcome_message()  # Show welcome message after clearing
        self.output_status.config(text="Cleared", fg="#f66a0a")
        self.master.after(2000, lambda: self.output_status.config(text="Ready", fg="#34C759"))
    
    def copy_output(self):
        """Copy all output text to clipboard."""
        try:
            content = self.output_text.get(1.0, tk.END).strip()
            self.master.clipboard_clear()
            self.master.clipboard_append(content)
            self.output_status.config(text="Copied", fg="#34C759")
            self.master.after(2000, lambda: self.output_status.config(text="Ready", fg="#34C759"))
        except Exception as e:
            messagebox.showerror("Copy Error", f"Failed to copy to clipboard: {e}")
    
    def copy_selection(self):
        """Copy selected text to clipboard."""
        try:
            if self.output_text.selection_get():
                selected_text = self.output_text.selection_get()
                self.master.clipboard_clear()
                self.master.clipboard_append(selected_text)
                self.output_status.config(text="Selection Copied", fg="#34C759")
                self.master.after(2000, lambda: self.output_status.config(text="Ready", fg="#34C759"))
        except tk.TclError:
            # No selection
            self.copy_output()
    
    def export_output(self):
        """Export output to a text file."""
        try:
            content = self.output_text.get(1.0, tk.END).strip()
            if not content:
                messagebox.showwarning("Export Warning", "No content to export.")
                return
            
            filename = filedialog.asksaveasfilename(
                defaultextension=".txt",
                filetypes=[("Text files", "*.txt"), ("Markdown files", "*.md"), ("All files", "*.*")],
                title="Export AI Review Output"
            )
            
            if filename:
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(content)
                self.output_status.config(text="Exported", fg="#34C759")
                self.master.after(2000, lambda: self.output_status.config(text="Ready", fg="#34C759"))
        except Exception as e:
            messagebox.showerror("Export Error", f"Failed to export file: {e}")
    
    def show_progress(self, show=True):
        """Show or hide progress indicator."""
        if show:
            self.progress_frame.pack(side=tk.BOTTOM, fill=tk.X, before=self.output_text)
            self._animate_progress()
        else:
            self.progress_frame.pack_forget()
    
    def _animate_progress(self):
        """Animate the progress bar."""
        if self.progress_frame.winfo_viewable():
            # Simple left-to-right animation
            self.progress_bar.pack(side=tk.LEFT, fill=tk.Y)
            width = self.progress_frame.winfo_width()
            if width > 1:
                self.progress_bar.configure(width=int(width * 0.3))
                self.master.after(100, self._animate_progress)

    def show_welcome_message(self):
        """Display initial instructions in the output area with enhanced formatting."""
        self.output_text.delete(1.0, tk.END)
        
        # Welcome header
        self.output_text.insert(tk.END, "Welcome to Local AI PR Reviewer!\n", "header1")
        self.output_text.insert(tk.END, "\n")
        
        # Getting started section
        self.output_text.insert(tk.END, "🚀 Getting Started\n", "header2")
        self.output_text.insert(tk.END, "━" * 50 + "\n", "separator")
        
        steps = [
            "1. Configure Ollama URL and Model above (defaults should work for local installation)",
            "2. Browse and select your Git repository",
            "3. Choose the From Branch (base for comparison) and To Branch (target with changes)", 
            "4. Click 'Start AI Review' to analyze the differences"
        ]
        
        for step in steps:
            self.output_text.insert(tk.END, f"{step}\n", "info")
        self.output_text.insert(tk.END, "\n")
        
        # Requirements section
        self.output_text.insert(tk.END, "⚙️ Requirements\n", "header2")
        self.output_text.insert(tk.END, "━" * 50 + "\n", "separator")
        
        requirements = [
            "• Ollama must be running locally",
            "• The specified model must be downloaded (e.g., 'ollama pull codellama')",
            "• Repository must be a valid Git repository with local branches"
        ]
        
        for req in requirements:
            self.output_text.insert(tk.END, f"{req}\n", "warning")
        self.output_text.insert(tk.END, "\n")
        
        # Current configuration section
        self.output_text.insert(tk.END, "🔧 Current Configuration\n", "header2")
        self.output_text.insert(tk.END, "━" * 50 + "\n", "separator")
        
        config_text = f"""• Ollama URL: {self.ollama_url_entry.get()}
• Model: {self.ollama_model_entry.get()}
"""
        self.output_text.insert(tk.END, config_text, "code")
        self.output_text.insert(tk.END, "\n")
        
        # Ready message
        self.output_text.insert(tk.END, "✅ Ready to review your code changes!\n", "success")
        
        # Make text read-only for welcome message
        self.output_text.config(state=tk.DISABLED)
        self.output_status.config(text="Welcome", fg="#0366d6")

    def _configure_combobox_styling(self):
        """Apply additional styling to comboboxes that may not work through themes."""
        try:
            # Try to access the combobox's internal listbox and style it
            for combobox in [self.base_branch_entry, self.target_branch_entry]:
                # Configure the combobox itself
                combobox.configure(background='#ffffff', foreground='#24292e')
                
                # Try to style the internal listbox (may not work on all systems)
                try:
                    popdown = combobox.tk.eval(f'{combobox._name}.popdown.f.l')
                    combobox.tk.call(popdown, 'configure', '-background', '#ffffff')
                    combobox.tk.call(popdown, 'configure', '-foreground', '#24292e')
                    combobox.tk.call(popdown, 'configure', '-selectbackground', '#0366d6')
                    combobox.tk.call(popdown, 'configure', '-selectforeground', 'white')
                except:
                    pass  # Fallback silently if internal access doesn't work
        except Exception:
            pass  # Ignore any styling errors

    def browse_repo_path(self):
        """Allows user to select a directory for the repository path."""
        directory = filedialog.askdirectory()
        if directory:
            self.repo_path_entry.delete(0, tk.END)
            self.repo_path_entry.insert(0, directory)
            self.update_status("Loading repository branches...", "blue")
            
            # Enable refresh button and populate branches
            self.refresh_btn.config_state(tk.NORMAL)
            self._populate_local_branches(directory)
            
            # Update welcome message with new config
            self.output_text.config(state=tk.NORMAL)
            self.show_welcome_message()

    def refresh_branches(self):
        """Refresh the list of local branches for the currently selected repository."""
        repo_path = self.repo_path_entry.get()
        if not repo_path or not os.path.isdir(os.path.join(repo_path, '.git')):
            messagebox.showerror("Input Error", "Please select a valid Git repository to refresh branches.")
            return
        self._populate_local_branches(repo_path)

    def _populate_local_branches(self, repo_path):
        """Populate the dropdowns with local branch names from the given repo path."""
        try:
            if not os.path.isdir(os.path.join(repo_path, '.git')):
                self.update_status("Error: Selected path is not a Git repository", "red")
                self._reset_branch_dropdowns()
                return

            cmd = ["git", "for-each-ref", "--format=%(refname:short)", "refs/heads/"]
            result = subprocess.run(cmd, cwd=repo_path, check=True, capture_output=True, text=True, encoding='utf-8')
            branches = [b.strip() for b in result.stdout.splitlines() if b.strip()]
            
            if branches:
                # Update base branch dropdown (only actual branches)
                self._update_option_menu(self.base_branch_entry, self.base_branch_var, branches, branches[0])
                
                # Update target branch dropdown (branches + HEAD)
                branch_options = branches + ["HEAD"]
                self._update_option_menu(self.target_branch_entry, self.target_branch_var, branch_options, "HEAD")
                
                # Enable review button with modern styling
                self.review_button.config_state(tk.NORMAL)
                self.update_status(f"Loaded {len(branches)} branches from repository", "green")
                
            else:
                self._reset_branch_dropdowns()
                self.update_status("No branches found in repository", "orange")
                
        except subprocess.CalledProcessError as e:
            self.update_status(f"Error accessing Git repository: {e}", "red")
            self._reset_branch_dropdowns()
        except Exception as e:
            self.update_status(f"Unexpected error: {e}", "red")
            self._reset_branch_dropdowns()

    def _update_option_menu(self, option_menu, var, values, default_value):
        """Update an OptionMenu with new values."""
        # Clear existing menu
        menu = option_menu['menu']
        menu.delete(0, 'end')
        
        # Add new values
        for value in values:
            menu.add_command(label=value, command=tk._setit(var, value))
        
        # Set default value
        var.set(default_value)
        
        # Update menu styling
        menu.configure(bg='#ffffff', fg='#24292e', activebackground='#0366d6',
                      activeforeground='white', relief='flat', bd=1)
    
    def _reset_branch_dropdowns(self):
        """Reset branch dropdowns to initial state."""
        self.base_branch_var.set("Select repository first...")
        self.target_branch_var.set("Select repository first...")
        
        # Clear dropdown menus
        base_menu = self.base_branch_entry['menu']
        base_menu.delete(0, 'end')
        base_menu.add_command(label="Select repository first...", command=tk._setit(self.base_branch_var, "Select repository first..."))
        
        target_menu = self.target_branch_entry['menu']
        target_menu.delete(0, 'end')
        target_menu.add_command(label="Select repository first...", command=tk._setit(self.target_branch_var, "Select repository first..."))
        
        self.review_button.config_state(tk.DISABLED)
        self.refresh_btn.config_state(tk.DISABLED)

    def update_status(self, message, color="blue"):
        """Updates the status label with improved color scheme."""
        color_map = {
            "blue": "#0366d6",
            "green": "#28a745", 
            "red": "#d73a49",
            "orange": "#f66a0a",
            "gray": "#586069"
        }
        final_color = color_map.get(color, color)
        self.status_label.config(text=message, fg=final_color)
        self.master.update_idletasks() # Refresh GUI immediately

    def start_review_thread(self):
        """Starts the review process in a separate thread to keep the GUI responsive."""
        repo_path = self.repo_path_entry.get()
        base_branch = self.base_branch_var.get()
        target_branch = self.target_branch_var.get()
        
        # Get current Ollama configuration from GUI
        ollama_url = self.ollama_url_entry.get().strip()
        ollama_model = self.ollama_model_entry.get().strip()

        # Validation
        if not repo_path:
            messagebox.showerror("Input Error", "Please provide a repository path.")
            return
            
        if not ollama_url or not ollama_model:
            messagebox.showerror("Input Error", "Please provide both Ollama URL and Model name.")
            return

        if not os.path.isdir(repo_path):
            messagebox.showerror("Input Error", "The provided repository path does not exist or is not a directory.")
            return
            
        if not os.path.isdir(os.path.join(repo_path, ".git")):
            messagebox.showerror("Input Error", "The provided path does not appear to be a Git repository.")
            return
            
        if base_branch == "Select repository first..." or target_branch == "Select repository first...":
            messagebox.showerror("Input Error", "Please select valid branches for comparison.")
            return

        # Clear output and setup for review
        self.output_text.config(state=tk.NORMAL)
        self.output_text.delete(1.0, tk.END)
        self.show_progress(True)
        self.update_status("Processing...", "blue")
        self.output_status.config(text="Processing", fg="#f66a0a")
        self.review_button.config_state(tk.DISABLED)

        # Start the review in a new thread, passing the GUI config
        threading.Thread(target=self._run_review, args=(repo_path, base_branch, target_branch, ollama_url, ollama_model)).start()

    def _run_review(self, repo_path, base_branch, target_branch, ollama_url, ollama_model):
        """Contains the core logic for Git diff and Ollama API call with enhanced output formatting."""
        original_cwd = os.getcwd()
        try:
            os.chdir(repo_path)

            # Review header with enhanced formatting
            self.output_text.insert(tk.END, "🔍 AI Code Review Analysis\n", "header1")
            self.output_text.insert(tk.END, "━" * 60 + "\n\n", "separator")
            
            # Configuration details
            self.output_text.insert(tk.END, "📊 Review Configuration\n", "header2")
            config_details = f"""• Repository: {os.path.basename(repo_path)}
• Path: {repo_path}
• Comparing: {base_branch} → {target_branch}
• AI Model: {ollama_model}
• Endpoint: {ollama_url}
"""
            self.output_text.insert(tk.END, config_details, "info")
            self.output_text.insert(tk.END, "\n")

            self.update_status(f"Generating diff from '{base_branch}' to '{target_branch}'...", "blue")
            self.output_status.config(text="Generating diff...", fg="#f66a0a")
            
            # Generate diff section
            self.output_text.insert(tk.END, "🔄 Generating Code Diff...\n", "header2")
            pr_diff = self._get_git_diff(base_branch, target_branch)

            if not pr_diff:
                self.output_text.insert(tk.END, "❌ No diff generated or found.\n", "warning")
                self.output_text.insert(tk.END, "The branches may be identical or have no common history.\n", "info")
                self.update_status("Review Finished (No Diff)", "orange")
                self.output_status.config(text="No changes found", fg="#f66a0a")
                return

            self.output_text.insert(tk.END, "✅ Diff generated successfully.\n", "success")
            self.output_text.insert(tk.END, f"📈 Found changes to analyze.\n\n", "info")
            
            # AI Analysis section
            self.output_text.insert(tk.END, "🤖 AI Analysis in Progress...\n", "header2")
            self.update_status("Calling Ollama model...", "blue")
            self.output_status.config(text="AI analyzing...", fg="#f66a0a")
            
            prompt = AI_PROMPT_TEMPLATE.format(diff=pr_diff)
            ai_feedback = self._call_ollama_api(prompt, ollama_url, ollama_model)

            # Results section with enhanced formatting
            self.output_text.insert(tk.END, "\n" + "═" * 60 + "\n", "separator")
            self.output_text.insert(tk.END, "🎯 AI REVIEW RESULTS\n", "ai_title")
            self.output_text.insert(tk.END, "═" * 60 + "\n\n", "separator")
            
            if ai_feedback:
                # Format the AI feedback with better structure
                self._format_ai_feedback(ai_feedback)
                self.update_status("Review Complete", "green")
                self.output_status.config(text="Complete", fg="#34C759")
            else:
                self.output_text.insert(tk.END, "❌ AI review failed to generate feedback.\n", "error")
                self.update_status("Review Failed", "red")
                self.output_status.config(text="Failed", fg="#d73a49")

        except Exception as e:
            self.output_text.insert(tk.END, f"\n💥 An unexpected error occurred:\n", "error")
            self.output_text.insert(tk.END, f"{str(e)}\n", "code")
            self.update_status("An Error Occurred", "red")
            self.output_status.config(text="Error", fg="#d73a49")
        finally:
            os.chdir(original_cwd)
            self.show_progress(False)
            self.review_button.config_state(tk.NORMAL)
            # Make output read-only after review
            self.output_text.config(state=tk.DISABLED)
    
    def _format_ai_feedback(self, feedback):
        """Format AI feedback with enhanced styling and structure."""
        lines = feedback.split('\n')
        current_section = None
        
        for line in lines:
            line = line.strip()
            if not line:
                self.output_text.insert(tk.END, "\n")
                continue
                
            # Detect different types of content
            if line.startswith('##') or line.startswith('**') or line.isupper() and len(line) > 10:
                # Section headers
                clean_line = line.replace('#', '').replace('*', '').strip()
                self.output_text.insert(tk.END, f"📋 {clean_line}\n", "header2")
                current_section = clean_line.lower()
            elif line.startswith('- ') or line.startswith('* ') or line.startswith('• '):
                # List items
                self.output_text.insert(tk.END, f"{line}\n", "feedback_item")
            elif 'bug' in line.lower() or 'error' in line.lower() or 'issue' in line.lower():
                # Potential issues
                self.output_text.insert(tk.END, f"🐛 {line}\n", "error")
            elif 'recommend' in line.lower() or 'suggest' in line.lower() or 'improve' in line.lower():
                # Recommendations
                self.output_text.insert(tk.END, f"💡 {line}\n", "warning")
            elif 'good' in line.lower() or 'well' in line.lower() or 'no issues' in line.lower():
                # Positive feedback
                self.output_text.insert(tk.END, f"✅ {line}\n", "success")
            elif line.startswith('```') or line.startswith('    '):
                # Code blocks
                self.output_text.insert(tk.END, f"{line}\n", "code")
            else:
                # Regular text
                self.output_text.insert(tk.END, f"{line}\n", "feedback_item")
        
        self.output_text.insert(tk.END, "\n")
        self.output_text.insert(tk.END, "━" * 60 + "\n", "separator")
        self.output_text.insert(tk.END, "✨ Review completed successfully!\n", "success")
        
        # Auto-scroll to bottom
        self.output_text.see(tk.END)
    
    def _insert_with_scroll(self, text, tag=None):
        """Insert text and auto-scroll to bottom."""
        self.output_text.insert(tk.END, text, tag)
        self.output_text.see(tk.END)
        self.master.update_idletasks()

    def _get_git_diff(self, base_branch, target_commit="HEAD"):
        """
        Generates the git diff between the base_branch and target_commit.
        Assumes the script is run within a Git repository.
        """
        try:
            # Use only local branches: verify the base branch exists locally (unless it's HEAD)
            if base_branch != "HEAD":
                self.update_status(f"Using local base branch '{base_branch}'...", "blue")
                try:
                    # Verify local branch exists
                    subprocess.run(["git", "rev-parse", "--verify", f"refs/heads/{base_branch}"], check=True, capture_output=True, text=True, encoding='utf-8')
                except subprocess.CalledProcessError:
                    self.output_text.insert(tk.END, f"Error: local base branch '{base_branch}' not found. Please provide a local branch name.\n")
                    return None

            # Verify target exists (could be branch or HEAD)
            if target_commit != "HEAD":
                # Get available branches from the base dropdown
                base_menu = self.base_branch_entry['menu']
                available_branches = []
                for i in range(base_menu.index('end') + 1):
                    try:
                        label = base_menu.entrycget(i, 'label')
                        if label != "Select repository first...":
                            available_branches.append(label)
                    except:
                        pass
                
                if target_commit in available_branches:
                    try:
                        subprocess.run(["git", "rev-parse", "--verify", f"refs/heads/{target_commit}"], check=True, capture_output=True, text=True, encoding='utf-8')
                    except subprocess.CalledProcessError:
                        self.output_text.insert(tk.END, f"Error: target branch '{target_commit}' not found locally.\n")
                        return None

            # Find the merge base (common ancestor) against the base branch
            merge_base_cmd = ["git", "merge-base", base_branch, target_commit]
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

    def _call_ollama_api(self, prompt_text, ollama_url, ollama_model):
        """Sends the prompt to the Ollama API using GUI-configured values with enhanced error formatting."""
        try:
            response = requests.post(ollama_url, json={
                "model": ollama_model,
                "prompt": prompt_text,
                "stream": False
            }, timeout=600)
            response.raise_for_status()
            return response.json()['response']
        except requests.exceptions.ConnectionError:
            self.output_text.insert(tk.END, "❌ Connection Error\n", "error")
            self.output_text.insert(tk.END, f"Could not connect to Ollama at {ollama_url}\n\n", "info")
            
            self.output_text.insert(tk.END, "🔧 Troubleshooting Steps:\n", "header2")
            troubleshoot = f"""1. Ensure Ollama is installed and running locally
2. Verify the model '{ollama_model}' has been downloaded
3. Start Ollama by running: ollama serve
4. Download the model by running: ollama pull {ollama_model}
"""
            self.output_text.insert(tk.END, troubleshoot, "warning")
            return None
        except requests.exceptions.RequestException as e:
            self.output_text.insert(tk.END, "❌ API Request Error\n", "error")
            self.output_text.insert(tk.END, f"Error details: {str(e)}\n", "code")
            if hasattr(e, 'response') and e.response:
                self.output_text.insert(tk.END, f"API Response: {e.response.text}\n", "code")
            return None

# --- Main application execution ---
if __name__ == "__main__":
    root = tk.Tk()
    app = AIPrReviewerApp(root)
    root.mainloop()