# How to Install Python with Tkinter Support on macOS

If you encounter the error `ModuleNotFoundError: No module named '_tkinter'`, your Python installation is missing Tkinter support. To fix this on macOS (especially when using pyenv), follow these steps:

1. **Install Tcl/Tk using Homebrew:**
	```sh
	brew install tcl-tk
	```

2. **Set environment variables so pyenv can find Tcl/Tk:**
	```sh
	export LDFLAGS="-L$(brew --prefix tcl-tk)/lib"
	export CPPFLAGS="-I$(brew --prefix tcl-tk)/include"
	export PKG_CONFIG_PATH="$(brew --prefix tcl-tk)/lib/pkgconfig"
	export PATH="$(brew --prefix tcl-tk)/bin:$PATH"
	```

3. **Reinstall Python with Tk support (replace 3.12.2 with your version if needed):**
	```sh
	env PYTHON_CONFIGURE_OPTS="--with-tcltk-includes='-I$(brew --prefix tcl-tk)/include' --with-tcltk-libs='-L$(brew --prefix tcl-tk)/lib -ltcl8.6 -ltk8.6'" pyenv install 3.12.2
	```

4. **Set the new Python version as your local or global version:**
	```sh
	pyenv global 3.12.2
	```

After this, Tkinter should work and you can run your script without errors.
