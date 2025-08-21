import tkinter as tk
from tkinter import scrolledtext, messagebox, filedialog, ttk
import os
import requests
import json
import subprocess
import threading
import time

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

        # From Branch (Source with changes)
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

        # To Branch (Target where changes are missing)
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
        
        # Main review button
        self.review_button = ModernButton(button_frame, text="🚀 Start AI Review", 
                                        command=self.start_review_thread,
                                        bg_color="#FF3B30", hover_color="#D70015", 
                                        active_color="#B8000F", text_color="white",
                                        font=("system", 14, "bold"),
                                        width=200, height=50, bg='#f6f8fa')
        self.review_button.pack(pady=(0, 5))
        self.review_button.config_state(tk.DISABLED)  # Disabled until branches are selected
        
        # Stop button (initially hidden)
        self.stop_button = ModernButton(button_frame, text="⏹️ Stop Review", 
                                       command=self.stop_review,
                                       bg_color="#FF9500", hover_color="#CC7700", 
                                       active_color="#B36600", text_color="white",
                                       font=("system", 12, "bold"),
                                       width=180, height=40, bg='#f6f8fa')
        # Don't pack the stop button initially - it will be shown when review starts
        
        # Quick connection test button
        self.test_button = ModernButton(button_frame, text="🔍 Test Ollama Connection", 
                                       command=self.test_ollama_connection,
                                       bg_color="#007AFF", hover_color="#0051D0", 
                                       active_color="#003D82", text_color="white",
                                       font=("system", 10, "bold"),
                                       width=180, height=32, bg='#f6f8fa')
        self.test_button.pack()

        # Speed statistics and progress frame
        self.stats_frame = tk.Frame(control_frame, bg='#f6f8fa')
        self.stats_frame.pack(fill=tk.X, pady=(10, 5))
        
        # Progress bar with percentage
        self.progress_container = tk.Frame(self.stats_frame, bg='#f6f8fa')
        self.progress_container.pack(fill=tk.X, pady=(0, 5))
        
        # Progress bar background
        self.progress_bg = tk.Frame(self.progress_container, bg='#e1e4e8', height=6, relief='flat', bd=0)
        self.progress_bg.pack(fill=tk.X, padx=20)
        
        # Progress bar fill
        self.progress_fill = tk.Frame(self.progress_bg, bg='#0366d6', height=6, relief='flat', bd=0)
        
        # Progress percentage label
        self.progress_percent = tk.Label(self.progress_container, text="", fg="#586069", 
                                       font=('Arial', 8, 'bold'), bg='#f6f8fa', anchor='center')
        
        # Speed statistics frame
        self.speed_stats_frame = tk.Frame(self.stats_frame, bg='#f6f8fa')
        self.speed_stats_frame.pack(fill=tk.X)
        
        # Create columns for different stats
        stats_columns = tk.Frame(self.speed_stats_frame, bg='#f6f8fa')
        stats_columns.pack()
        
        # Time stats
        time_frame = tk.Frame(stats_columns, bg='#f6f8fa')
        time_frame.pack(side=tk.LEFT, padx=10)
        
        tk.Label(time_frame, text="⏱️ Time", fg="#586069", font=('Arial', 8, 'bold'), bg='#f6f8fa').pack()
        self.time_stat = tk.Label(time_frame, text="--", fg="#24292e", font=('SF Mono', 9) if tk.TkVersion >= 8.5 else ('Monaco', 9), bg='#f6f8fa')
        self.time_stat.pack()
        
        # Speed stats
        speed_frame = tk.Frame(stats_columns, bg='#f6f8fa')
        speed_frame.pack(side=tk.LEFT, padx=10)
        
        tk.Label(speed_frame, text="🚀 Speed", fg="#586069", font=('Arial', 8, 'bold'), bg='#f6f8fa').pack()
        self.speed_stat = tk.Label(speed_frame, text="--", fg="#24292e", font=('SF Mono', 9) if tk.TkVersion >= 8.5 else ('Monaco', 9), bg='#f6f8fa')
        self.speed_stat.pack()
        
        # Tokens stats
        tokens_frame = tk.Frame(stats_columns, bg='#f6f8fa')
        tokens_frame.pack(side=tk.LEFT, padx=10)
        
        tk.Label(tokens_frame, text="📊 Tokens", fg="#586069", font=('Arial', 8, 'bold'), bg='#f6f8fa').pack()
        self.tokens_stat = tk.Label(tokens_frame, text="--", fg="#24292e", font=('SF Mono', 9) if tk.TkVersion >= 8.5 else ('Monaco', 9), bg='#f6f8fa')
        self.tokens_stat.pack()
        
        # Model stats
        model_frame = tk.Frame(stats_columns, bg='#f6f8fa')
        model_frame.pack(side=tk.LEFT, padx=10)
        
        tk.Label(model_frame, text="🤖 Model", fg="#586069", font=('Arial', 8, 'bold'), bg='#f6f8fa').pack()
        self.model_stat = tk.Label(model_frame, text="--", fg="#24292e", font=('SF Mono', 9) if tk.TkVersion >= 8.5 else ('Monaco', 9), bg='#f6f8fa')
        self.model_stat.pack()
        
        # Hide stats initially
        self.hide_stats()

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
        
        # Threading control
        self.review_thread = None
        self.stop_review_flag = threading.Event()
        self.current_request = None  # Store current requests session for cancellation

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
    
    def show_stats(self):
        """Show the speed statistics panel."""
        self.stats_frame.pack(fill=tk.X, pady=(10, 5))
    
    def hide_stats(self):
        """Hide the speed statistics panel."""
        self.stats_frame.pack_forget()
        
    def reset_stats(self):
        """Reset all statistics to default values."""
        self.time_stat.config(text="--")
        self.speed_stat.config(text="--")
        self.tokens_stat.config(text="--")
        self.model_stat.config(text="--")
        self.progress_fill.place_forget()
        self.progress_percent.config(text="")
        self.hide_stats()
    
    def update_progress_bar(self, percentage):
        """Update the progress bar with a specific percentage."""
        if percentage < 0:
            percentage = 0
        elif percentage > 100:
            percentage = 100
            
        # Update progress bar
        if percentage > 0:
            self.progress_fill.place(relwidth=percentage/100, relheight=1.0)
            self.progress_percent.config(text=f"{percentage:.0f}%")
            self.progress_percent.pack(pady=(2, 0))
        else:
            self.progress_fill.place_forget()
            self.progress_percent.config(text="")
    
    def update_speed_stats(self, elapsed_time=None, tokens_count=None, model_name=None, phase=""):
        """Update speed statistics with current values."""
        if elapsed_time is not None:
            if elapsed_time < 60:
                self.time_stat.config(text=f"{elapsed_time:.1f}s")
            else:
                minutes = int(elapsed_time // 60)
                seconds = elapsed_time % 60
                self.time_stat.config(text=f"{minutes}m {seconds:.0f}s")
        
        if tokens_count is not None and elapsed_time is not None and elapsed_time > 0:
            tokens_per_sec = tokens_count / elapsed_time
            if tokens_per_sec >= 1:
                self.speed_stat.config(text=f"{tokens_per_sec:.1f} t/s")
            else:
                self.speed_stat.config(text=f"{tokens_per_sec:.2f} t/s")
        
        if tokens_count is not None:
            if tokens_count >= 1000:
                self.tokens_stat.config(text=f"{tokens_count/1000:.1f}k")
            else:
                self.tokens_stat.config(text=f"{tokens_count}")
        
        if model_name is not None:
            # Truncate long model names
            display_name = model_name if len(model_name) <= 12 else model_name[:12] + "..."
            self.model_stat.config(text=display_name)
        
        # Show stats panel if any data was provided
        if any(x is not None for x in [elapsed_time, tokens_count, model_name]):
            self.show_stats()

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
            "3. Choose the From Branch (branch with new changes) and To Branch (main will be auto-selected if available)", 
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
                # Default to common main branches in order of preference, otherwise use "HEAD"
                default_target = "HEAD"  # fallback
                for main_branch in ["main", "master", "develop"]:
                    if main_branch in branches:
                        default_target = main_branch
                        break
                self._update_option_menu(self.target_branch_entry, self.target_branch_var, branch_options, default_target)
                
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

    def test_ollama_connection(self):
        """Test Ollama connection and model availability quickly."""
        ollama_url = self.ollama_url_entry.get().strip()
        ollama_model = self.ollama_model_entry.get().strip()
        
        if not ollama_url or not ollama_model:
            messagebox.showerror("Configuration Error", "Please provide both Ollama URL and Model name.")
            return
        
        # Clear output and show test results
        self.output_text.config(state=tk.NORMAL)
        self.output_text.delete(1.0, tk.END)
        
        self.output_text.insert(tk.END, "🔍 Ollama Connection Test\n", "header1")
        self.output_text.insert(tk.END, "━" * 50 + "\n\n", "separator")
        
        self.output_text.insert(tk.END, f"Testing connection to: {ollama_url}\n", "info")
        self.output_text.insert(tk.END, f"Using model: {ollama_model}\n\n", "info")
        
        self.update_status("Testing connection...", "blue")
        self.master.update_idletasks()
        
        try:
            # Test 1: Check if Ollama server is running
            self.output_text.insert(tk.END, "1️⃣ Testing server connectivity...", "info")
            self.master.update_idletasks()
            
            version_url = ollama_url.replace('/api/generate', '/api/version')
            start_time = time.time()
            
            try:
                response = requests.get(version_url, timeout=(3, 5))
                elapsed = time.time() - start_time
                
                if response.status_code == 200:
                    self.output_text.insert(tk.END, f" ✅ ({elapsed:.1f}s)\n", "success")
                    if response.headers.get('content-type', '').startswith('application/json'):
                        try:
                            version_data = response.json()
                            self.output_text.insert(tk.END, f"   Version: {version_data.get('version', 'Unknown')}\n", "info")
                        except:
                            pass
                else:
                    self.output_text.insert(tk.END, f" ⚠️ Status {response.status_code} ({elapsed:.1f}s)\n", "warning")
                    
            except requests.exceptions.ConnectionError:
                self.output_text.insert(tk.END, " ❌ Connection failed\n", "error")
                self.output_text.insert(tk.END, "   • Make sure Ollama is running: ollama serve\n", "warning")
                self.output_text.insert(tk.END, "   • Check if port 11434 is available\n", "warning")
                self.update_status("Connection failed", "red")
                return
                
            except requests.exceptions.Timeout:
                self.output_text.insert(tk.END, " ⏰ Timeout (>3s)\n", "error")
                
            # Test 2: Check model availability with a quick request
            self.output_text.insert(tk.END, "\n2️⃣ Testing model availability...", "info")
            self.master.update_idletasks()
            
            start_time = time.time()
            try:
                test_response = requests.post(ollama_url, json={
                    "model": ollama_model,
                    "prompt": "Test",
                    "stream": False
                }, timeout=(5, 15))
                
                elapsed = time.time() - start_time
                
                if test_response.status_code == 200:
                    self.output_text.insert(tk.END, f" ✅ ({elapsed:.1f}s)\n", "success")
                    try:
                        response_data = test_response.json()
                        if 'response' in response_data:
                            response_text = response_data['response'][:50]
                            self.output_text.insert(tk.END, f"   Sample: \"{response_text}...\"\n", "info")
                    except:
                        pass
                elif test_response.status_code == 404:
                    self.output_text.insert(tk.END, " ❌ Model not found\n", "error")
                    self.output_text.insert(tk.END, f"   • Download model: ollama pull {ollama_model}\n", "warning")
                    self.output_text.insert(tk.END, f"   • List available models: ollama list\n", "warning")
                else:
                    self.output_text.insert(tk.END, f" ❌ Status {test_response.status_code}\n", "error")
                    
            except requests.exceptions.Timeout:
                self.output_text.insert(tk.END, " ⏰ Timeout (>15s)\n", "warning")
                self.output_text.insert(tk.END, "   • Model may be loading or system is slow\n", "info")
                
            # Test 3: Performance check
            self.output_text.insert(tk.END, "\n3️⃣ Quick performance test...", "info")
            self.master.update_idletasks()
            
            start_time = time.time()
            try:
                perf_response = requests.post(ollama_url, json={
                    "model": ollama_model,
                    "prompt": "Hello, respond with just 'Hi'",
                    "stream": True
                }, timeout=(5, 20), stream=True)
                
                if perf_response.status_code == 200:
                    tokens = 0
                    first_token_time = None
                    
                    for line in perf_response.iter_lines():
                        if line:
                            try:
                                chunk_data = json.loads(line.decode('utf-8'))
                                if 'response' in chunk_data and chunk_data['response']:
                                    if first_token_time is None:
                                        first_token_time = time.time()
                                    tokens += 1
                                if chunk_data.get('done', False):
                                    break
                            except:
                                continue
                    
                    total_time = time.time() - start_time
                    if first_token_time:
                        first_token_delay = first_token_time - start_time
                        tokens_per_sec = tokens / total_time if total_time > 0 else 0
                        self.output_text.insert(tk.END, f" ✅ ({total_time:.1f}s)\n", "success")
                        self.output_text.insert(tk.END, f"   First token: {first_token_delay:.1f}s, Speed: {tokens_per_sec:.1f} t/s\n", "info")
                    else:
                        self.output_text.insert(tk.END, f" ⚠️ No response received\n", "warning")
                else:
                    self.output_text.insert(tk.END, f" ❌ Status {perf_response.status_code}\n", "error")
                    
            except requests.exceptions.Timeout:
                self.output_text.insert(tk.END, " ⏰ Timeout (>20s)\n", "warning")
                
            # Summary
            self.output_text.insert(tk.END, "\n" + "━" * 50 + "\n", "separator")
            self.output_text.insert(tk.END, "✅ Connection test completed!\n", "success")
            self.output_text.insert(tk.END, "You can now try running a code review.\n", "info")
            
            self.update_status("Connection test completed", "green")
            
        except Exception as e:
            self.output_text.insert(tk.END, f"\n❌ Test failed: {str(e)}\n", "error")
            self.update_status("Test failed", "red")
        
        finally:
            self.output_text.config(state=tk.DISABLED)

    def start_review_thread(self):
        """Starts the review process in a separate thread to keep the GUI responsive."""
        repo_path = self.repo_path_entry.get()
        source_branch = self.base_branch_var.get()  # Branch with new changes
        target_branch = self.target_branch_var.get()  # Branch where changes are missing
        
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
            
        if source_branch == "Select repository first..." or target_branch == "Select repository first...":
            messagebox.showerror("Input Error", "Please select valid branches for comparison.")
            return

        # Clear output and setup for review
        self.output_text.config(state=tk.NORMAL)
        self.output_text.delete(1.0, tk.END)
        self.show_progress(True)
        self.reset_stats()
        self.show_stats()
        self.update_progress_bar(0)
        self.update_status("Processing...", "blue")
        self.output_status.config(text="Processing", fg="#f66a0a")
        
        # Update UI for review state
        self.review_button.config_state(tk.DISABLED)
        self.stop_button.pack(pady=(0, 5))  # Show stop button
        self.test_button.pack_forget()  # Hide test button during review
        
        # Reset stop flag
        self.stop_review_flag.clear()

        # Start the review in a new thread, passing the GUI config
        self.review_thread = threading.Thread(target=self._run_review, args=(repo_path, source_branch, target_branch, ollama_url, ollama_model))
        self.review_thread.start()

    def stop_review(self):
        """Stop the currently running review process."""
        if self.review_thread and self.review_thread.is_alive():
            # Set the stop flag
            self.stop_review_flag.set()
            
            # Cancel current request if any
            if self.current_request:
                try:
                    # Note: requests doesn't have a direct cancel method, but we can close the session
                    pass
                except:
                    pass
            
            # Update UI immediately
            self.output_text.config(state=tk.NORMAL)
            self.output_text.insert(tk.END, "\n🛑 Review stopped by user\n", "warning")
            self.output_text.insert(tk.END, "━" * 50 + "\n", "separator")
            self.output_text.config(state=tk.DISABLED)
            
            self.update_status("Review stopped", "orange")
            self.output_status.config(text="Stopped", fg="#FF9500")
            
            # Reset UI state
            self._reset_review_ui()
            
    def _reset_review_ui(self):
        """Reset UI to initial state after review completion or stop."""
        self.show_progress(False)
        self.review_button.config_state(tk.NORMAL)
        self.stop_button.pack_forget()  # Hide stop button
        self.test_button.pack()  # Show test button again
        self.review_thread = None
        self.current_request = None

    def _run_review(self, repo_path, source_branch, target_branch, ollama_url, ollama_model):
        """Contains the core logic for Git diff and Ollama API call with enhanced output formatting."""
        original_cwd = os.getcwd()
        review_start_time = time.time()
        
        try:
            os.chdir(repo_path)

            # Check for stop signal
            if self.stop_review_flag.is_set():
                return

            # Initialize stats tracking
            self.update_speed_stats(model_name=ollama_model)
            self.update_progress_bar(5)  # 5% - Started

            # Review header with enhanced formatting
            self.output_text.insert(tk.END, "🔍 AI Code Review Analysis\n", "header1")
            self.output_text.insert(tk.END, "━" * 60 + "\n\n", "separator")
            
            # Check for stop signal
            if self.stop_review_flag.is_set():
                return
            
            # Configuration details
            self.output_text.insert(tk.END, "📊 Review Configuration\n", "header2")
            config_details = f"""• Repository: {os.path.basename(repo_path)}
• Path: {repo_path}
• Comparing: {target_branch} → {source_branch}
• AI Model: {ollama_model}
• Endpoint: {ollama_url}
"""
            self.output_text.insert(tk.END, config_details, "info")
            self.output_text.insert(tk.END, "\n")

            self.update_progress_bar(15)  # 15% - Config displayed
            
            # Check for stop signal
            if self.stop_review_flag.is_set():
                return
                
            self.update_status(f"Generating diff from '{target_branch}' to '{source_branch}'...", "blue")
            self.output_status.config(text="Generating diff...", fg="#f66a0a")
            self.master.update_idletasks()
            
            # Generate diff section
            self.output_text.insert(tk.END, "🔄 Generating Code Diff...\n", "header2")
            self.output_text.insert(tk.END, f"• Source branch: {source_branch}\n", "info")
            self.output_text.insert(tk.END, f"• Target branch: {target_branch}\n", "info")
            self.output_text.insert(tk.END, "• Finding differences...\n", "info")
            self.master.update_idletasks()
            
            diff_start_time = time.time()
            pr_diff = self._get_git_diff(target_branch, source_branch)
            diff_elapsed = time.time() - diff_start_time
            
            # Check for stop signal
            if self.stop_review_flag.is_set():
                return
            
            self.update_progress_bar(35)  # 35% - Diff generated
            self.update_speed_stats(elapsed_time=time.time() - review_start_time)

            if not pr_diff:
                self.output_text.insert(tk.END, "❌ No diff generated or found.\n", "warning")
                self.output_text.insert(tk.END, "The branches may be identical or have no common history.\n", "info")
                self.update_status("Review Finished (No Diff)", "orange")
                self.output_status.config(text="No changes found", fg="#f66a0a")
                self.update_progress_bar(100)
                return

            self.output_text.insert(tk.END, "✅ Diff generated successfully.\n", "success")
            self.output_text.insert(tk.END, f"📈 Found changes to analyze.\n\n", "info")
            
            # Check for stop signal before AI analysis
            if self.stop_review_flag.is_set():
                return
            
            # AI Analysis section with enhanced progress tracking
            self.output_text.insert(tk.END, "🤖 AI Analysis in Progress...\n", "header2")
            self.update_status("Preparing AI request...", "blue")
            self.output_status.config(text="Preparing request...", fg="#f66a0a")
            self.master.update_idletasks()
            
            # Show what we're about to send to the AI
            self.output_text.insert(tk.END, f"📤 Preparing prompt for AI model ({ollama_model})...\n", "info")
            self.master.update_idletasks()
            
            self.update_progress_bar(45)  # 45% - About to call AI
            
            # Check for stop signal before AI call
            if self.stop_review_flag.is_set():
                return
            
            prompt = AI_PROMPT_TEMPLATE.format(diff=pr_diff)
            
            # Update status to show API call
            self.update_status("Calling Ollama API...", "blue")
            self.output_status.config(text="Calling AI model...", fg="#f66a0a")
            self.master.update_idletasks()
            
            ai_start_time = time.time()
            ai_feedback = self._call_ollama_api(prompt, ollama_url, ollama_model)
            ai_elapsed = time.time() - ai_start_time
            
            # Check for stop signal after AI call
            if self.stop_review_flag.is_set():
                return
            
            total_elapsed = time.time() - review_start_time
            
            # Final stats update after AI completion
            if ai_feedback:
                estimated_tokens = len(ai_feedback.split())  # Rough token estimation
                self.update_speed_stats(elapsed_time=total_elapsed, tokens_count=estimated_tokens, model_name=ollama_model)
            
            self.update_progress_bar(90)  # 90% - AI analysis complete

            # Results section with enhanced formatting
            self.output_text.insert(tk.END, "\n" + "═" * 60 + "\n", "separator")
            self.output_text.insert(tk.END, "🎯 AI REVIEW RESULTS\n", "ai_title")
            self.output_text.insert(tk.END, "═" * 60 + "\n\n", "separator")
            
            if ai_feedback:
                # Format the AI feedback with better structure
                self._format_ai_feedback(ai_feedback)
                self.update_progress_bar(100)  # 100% - Complete
                self.update_status("Review Complete", "green")
                self.output_status.config(text="Complete", fg="#34C759")
                
                # Final timing summary
                self.output_text.insert(tk.END, f"\n⏱️ Performance Summary:\n", "header2")
                performance_summary = f"""• Total Time: {total_elapsed:.1f}s
• Diff Generation: {diff_elapsed:.1f}s
• AI Analysis: {ai_elapsed:.1f}s
• Model: {ollama_model}
"""
                self.output_text.insert(tk.END, performance_summary, "info")
                
            else:
                self.output_text.insert(tk.END, "❌ AI review failed to generate feedback.\n", "error")
                self.update_progress_bar(0)
                self.update_status("Review Failed", "red")
                self.output_status.config(text="Failed", fg="#d73a49")

        except Exception as e:
            if not self.stop_review_flag.is_set():  # Only show error if not stopped by user
                self.output_text.insert(tk.END, f"\n💥 An unexpected error occurred:\n", "error")
                self.output_text.insert(tk.END, f"{str(e)}\n", "code")
                self.update_progress_bar(0)
                self.update_status("An Error Occurred", "red")
                self.output_status.config(text="Error", fg="#d73a49")
        finally:
            os.chdir(original_cwd)
            if not self.stop_review_flag.is_set():  # Only clean up UI if not already done by stop
                self._reset_review_ui()
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
        Shows what changes exist in target_commit that are missing from base_branch.
        Assumes the script is run within a Git repository.
        """
        try:
            self.output_text.insert(tk.END, "🔍 Debug: Git diff process starting...\n", "info")
            self.master.update_idletasks()
            
            # Use only local branches: verify the base branch exists locally (unless it's HEAD)
            if base_branch != "HEAD":
                self.update_status(f"Using local base branch '{base_branch}'...", "blue")
                self.output_text.insert(tk.END, f"• Verifying base branch '{base_branch}' exists locally...\n", "info")
                self.master.update_idletasks()
                try:
                    # Verify local branch exists
                    subprocess.run(["git", "rev-parse", "--verify", f"refs/heads/{base_branch}"], check=True, capture_output=True, text=True, encoding='utf-8')
                    self.output_text.insert(tk.END, f"✅ Base branch '{base_branch}' found\n", "success")
                except subprocess.CalledProcessError:
                    self.output_text.insert(tk.END, f"❌ Error: local base branch '{base_branch}' not found. Please provide a local branch name.\n", "error")
                    return None

            # Verify target exists (could be branch or HEAD)
            if target_commit != "HEAD":
                self.output_text.insert(tk.END, f"• Verifying target '{target_commit}'...\n", "info")
                self.master.update_idletasks()
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
                        self.output_text.insert(tk.END, f"✅ Target '{target_commit}' found\n", "success")
                    except subprocess.CalledProcessError:
                        self.output_text.insert(tk.END, f"❌ Error: target branch '{target_commit}' not found locally.\n", "error")
                        return None
            else:
                self.output_text.insert(tk.END, f"✅ Using HEAD as target\n", "success")

            self.master.update_idletasks()
            
            # Find the merge base (common ancestor) against the base branch
            self.output_text.insert(tk.END, "• Finding common ancestor (merge base)...\n", "info")
            self.update_status("Finding merge base...", "blue")
            self.master.update_idletasks()
            
            merge_base_cmd = ["git", "merge-base", base_branch, target_commit]
            merge_base_result = subprocess.run(merge_base_cmd, check=True, capture_output=True, text=True, encoding='utf-8')
            merge_base_commit = merge_base_result.stdout.strip()
            
            self.output_text.insert(tk.END, f"✅ Merge base: {merge_base_commit[:8]}...\n", "success")
            self.output_text.insert(tk.END, "• Generating diff...\n", "info")
            self.update_status("Computing diff...", "blue")
            self.master.update_idletasks()

            diff_command = ["git", "diff", "--no-prefix", "-U3", merge_base_commit, target_commit]
            result = subprocess.run(diff_command, check=True, capture_output=True, text=True, encoding='utf-8', errors='ignore')
            diff_output = result.stdout.strip()
            
            if diff_output:
                lines_count = len(diff_output.split('\n'))
                chars_count = len(diff_output)
                self.output_text.insert(tk.END, f"✅ Diff generated successfully ({lines_count} lines, {chars_count} chars)\n", "success")
            else:
                self.output_text.insert(tk.END, "⚠️ No differences found between branches\n", "warning")
            
            return diff_output
        except subprocess.CalledProcessError as e:
            self.output_text.insert(tk.END, f"❌ Error executing git command: {e.cmd}\n", "error")
            self.output_text.insert(tk.END, f"Return code: {e.returncode}\n", "code")
            if e.stdout:
                self.output_text.insert(tk.END, f"Stdout: {e.stdout}\n", "code")
            if e.stderr:
                self.output_text.insert(tk.END, f"Stderr: {e.stderr}\n", "code")
            return None
        except Exception as e:
            self.output_text.insert(tk.END, f"❌ Error getting diff: {e}\n", "error")
            return None

    def _call_ollama_api(self, prompt_text, ollama_url, ollama_model):
        """Sends the prompt to the Ollama API using GUI-configured values with enhanced error formatting and progress tracking."""
        try:
            # Check for stop signal before starting
            if self.stop_review_flag.is_set():
                self.output_text.insert(tk.END, f"\n🛑 API call stopped by user\n", "warning")
                return ""  # Return empty response to indicate cancellation
            
            # Debug output - show request details
            self.output_text.insert(tk.END, "🔧 Debug Information:\n", "header2")
            debug_info = f"""• Model: {ollama_model}
• API URL: {ollama_url}
• Prompt Length: {len(prompt_text)} characters
• Connection Timeout: 10 seconds
• Request Timeout: 120 seconds
"""
            self.output_text.insert(tk.END, debug_info, "info")
            self.output_text.insert(tk.END, "\n🚀 Testing Ollama connection...\n", "info")
            
            # Update status to show we're testing the connection
            self.update_status("Testing Ollama connection...", "blue")
            self.master.update_idletasks()
            
            # First, test if Ollama is running with a quick version check
            version_url = ollama_url.replace('/api/generate', '/api/version')
            try:
                self.output_text.insert(tk.END, f"• Checking {version_url}...\n", "info")
                self.master.update_idletasks()
                
                version_response = requests.get(version_url, timeout=(5, 10))
                if version_response.status_code == 200:
                    self.output_text.insert(tk.END, "✅ Ollama server is responding\n", "success")
                else:
                    self.output_text.insert(tk.END, f"⚠️ Unexpected response code: {version_response.status_code}\n", "warning")
            except requests.exceptions.ConnectionError:
                self.output_text.insert(tk.END, "❌ Cannot connect to Ollama server\n", "error")
                self.output_text.insert(tk.END, f"Make sure Ollama is running: ollama serve\n", "warning")
                raise
            except requests.exceptions.Timeout:
                self.output_text.insert(tk.END, "⏰ Connection timeout - Ollama server may be slow\n", "warning")
                self.output_text.insert(tk.END, "Continuing with API call...\n", "info")
            
            # Test if model is available
            try:
                self.output_text.insert(tk.END, f"• Testing model '{ollama_model}' availability...\n", "info")
                self.master.update_idletasks()
                
                # Try a very small test prompt to verify model works
                test_response = requests.post(ollama_url, json={
                    "model": ollama_model,
                    "prompt": "Hi",
                    "stream": False
                }, timeout=(10, 30))  # 10s connection, 30s read timeout for test
                
                if test_response.status_code == 200:
                    self.output_text.insert(tk.END, f"✅ Model '{ollama_model}' is ready\n", "success")
                else:
                    self.output_text.insert(tk.END, f"⚠️ Model test returned code: {test_response.status_code}\n", "warning")
                    if test_response.status_code == 404:
                        self.output_text.insert(tk.END, f"❌ Model '{ollama_model}' not found. Run: ollama pull {ollama_model}\n", "error")
                        return None
                        
            except requests.exceptions.ConnectionError:
                self.output_text.insert(tk.END, "❌ Connection lost during model test\n", "error")
                raise
            except requests.exceptions.Timeout:
                self.output_text.insert(tk.END, "⏰ Model test timeout - but continuing with main request\n", "warning")
            except Exception as e:
                self.output_text.insert(tk.END, f"⚠️ Model test failed: {str(e)}\n", "warning")
                self.output_text.insert(tk.END, "Continuing with main request...\n", "info")
            
            self.output_text.insert(tk.END, "\n🚀 Sending main request to Ollama...\n", "info")
            
            # Update status to show we're making the API call
            self.update_status("Sending request to Ollama API...", "blue")
            self.master.update_idletasks()
            
            start_time = time.time()
            
            # Try streaming first for better user experience
            try:
                return self._call_ollama_streaming(prompt_text, ollama_url, ollama_model, start_time)
            except Exception as e:
                # Fall back to non-streaming if streaming fails
                self.output_text.insert(tk.END, f"⚠️ Streaming failed, falling back to standard request: {str(e)}\n", "warning")
                return self._call_ollama_standard(prompt_text, ollama_url, ollama_model, start_time)
            
        except requests.exceptions.ConnectionError:
            self.output_text.insert(tk.END, "❌ Connection Error\n", "error")
            self.output_text.insert(tk.END, f"Could not connect to Ollama at {ollama_url}\n\n", "info")
            
            self.output_text.insert(tk.END, "🔧 Troubleshooting Steps:\n", "header2")
            troubleshoot = f"""1. Ensure Ollama is installed and running locally
2. Start Ollama by running: ollama serve
3. Verify the model '{ollama_model}' has been downloaded: ollama pull {ollama_model}
4. Check if Ollama is running: curl {ollama_url.replace('/api/generate', '/api/version')}
5. Try a different port if running on custom port
6. Check firewall settings if running on different machine
"""
            self.output_text.insert(tk.END, troubleshoot, "warning")
            return None
        except requests.exceptions.Timeout:
            self.output_text.insert(tk.END, "⏰ Request Timeout\n", "error")
            self.output_text.insert(tk.END, "The AI model took too long to respond (>2 minutes)\n", "info")
            self.output_text.insert(tk.END, "Consider using a smaller model or check system resources\n", "warning")
            return None
        except requests.exceptions.RequestException as e:
            self.output_text.insert(tk.END, "❌ API Request Error\n", "error")
            self.output_text.insert(tk.END, f"Error details: {str(e)}\n", "code")
            if hasattr(e, 'response') and e.response:
                self.output_text.insert(tk.END, f"HTTP Status: {e.response.status_code}\n", "code")
                self.output_text.insert(tk.END, f"API Response: {e.response.text}\n", "code")
            return None
        except json.JSONDecodeError as e:
            self.output_text.insert(tk.END, "❌ JSON Decode Error\n", "error")
            self.output_text.insert(tk.END, f"Could not parse API response as JSON: {str(e)}\n", "code")
            return None
        except Exception as e:
            self.output_text.insert(tk.END, "❌ Unexpected Error\n", "error")
            self.output_text.insert(tk.END, f"Error: {str(e)}\n", "code")
            return None
    
    def _call_ollama_streaming(self, prompt_text, ollama_url, ollama_model, start_time):
        """Make a streaming request to Ollama API with real-time progress."""
        self.output_text.insert(tk.END, "� Using streaming mode for real-time updates...\n", "info")
        self.master.update_idletasks()
        
        response = requests.post(ollama_url, json={
            "model": ollama_model,
            "prompt": prompt_text,
            "stream": True
        }, timeout=(10, 120), stream=True)  # 10s connection, 2min read timeout
        
        response.raise_for_status()
        
        # Track response progress
        full_response = ""
        chunk_count = 0
        last_update = time.time()
        
        self.output_text.insert(tk.END, "⏳ Receiving streamed response", "warning")
        
        for line in response.iter_lines():
            # Check for stop signal
            if self.stop_review_flag.is_set():
                self.output_text.insert(tk.END, f"\n🛑 Streaming stopped by user\n", "warning")
                return ""  # Return empty response to indicate cancellation
            
            if line:
                try:
                    chunk_data = json.loads(line.decode('utf-8'))
                    if 'response' in chunk_data:
                        chunk_text = chunk_data['response']
                        full_response += chunk_text
                        chunk_count += 1
                        
                        # Update progress every 0.5 seconds or every 10 chunks
                        current_time = time.time()
                        if current_time - last_update > 0.5 or chunk_count % 10 == 0:
                            # Gradually increase progress from 50% to 85% during streaming
                            progress = min(85, 50 + (chunk_count / 10) * 2)
                            self.update_progress_bar(progress)
                            
                            elapsed = current_time - start_time
                            self.update_status(f"Receiving AI response... {chunk_count} tokens in {elapsed:.1f}s", "blue")
                            last_update = current_time
                            
                            # Update stats every 2 seconds during streaming
                            if chunk_count % 20 == 0:
                                self.update_speed_stats(elapsed_time=elapsed, tokens_count=chunk_count, model_name=ollama_model)
                            
                            self.master.update_idletasks()
                    
                    # Check if this is the final chunk
                    if chunk_data.get('done', False):
                        break
                        
                except json.JSONDecodeError:
                    continue
        
        elapsed_time = time.time() - start_time
        self.output_text.insert(tk.END, f"\n✅ Streaming completed in {elapsed_time:.2f} seconds\n", "success")
        self.output_text.insert(tk.END, f"📊 Received {chunk_count} chunks\n", "info")
        self.output_text.insert(tk.END, f"📝 Total Response Length: {len(full_response)} characters\n", "info")
        self.output_text.insert(tk.END, "\n", "")
        
        # Final stats update
        self.update_speed_stats(elapsed_time=elapsed_time, tokens_count=chunk_count, model_name=ollama_model)
        
        return full_response
    
    def _call_ollama_standard(self, prompt_text, ollama_url, ollama_model, start_time):
        """Make a standard non-streaming request to Ollama API."""
        # Check for stop signal before starting
        if self.stop_review_flag.is_set():
            self.output_text.insert(tk.END, f"\n🛑 Request stopped by user\n", "warning")
            return ""  # Return empty response to indicate cancellation
            
        self.output_text.insert(tk.END, "⏳ Waiting for AI model response (non-streaming)...\n", "warning")
        self.master.update_idletasks()
        
        response = requests.post(ollama_url, json={
            "model": ollama_model,
            "prompt": prompt_text,
            "stream": False
        }, timeout=(10, 120))  # 10s connection, 2min read timeout
        
        elapsed_time = time.time() - start_time
        
        # Debug response information
        self.output_text.insert(tk.END, f"✅ Response received in {elapsed_time:.2f} seconds\n", "success")
        self.output_text.insert(tk.END, f"📊 Response Status: {response.status_code}\n", "info")
        self.output_text.insert(tk.END, f"📦 Response Size: {len(response.text)} characters\n", "info")
        
        response.raise_for_status()
        
        # Parse and validate response
        response_data = response.json()
        if 'response' not in response_data:
            self.output_text.insert(tk.END, "⚠️ Warning: Unexpected response format\n", "warning")
            self.output_text.insert(tk.END, f"Raw response: {response.text[:200]}...\n", "code")
            return None
            
        ai_response = response_data['response']
        self.output_text.insert(tk.END, f"📝 AI Response Length: {len(ai_response)} characters\n", "info")
        self.output_text.insert(tk.END, "\n", "")
        
        return ai_response

# --- Main application execution ---
if __name__ == "__main__":
    root = tk.Tk()
    app = AIPrReviewerApp(root)
    root.mainloop()