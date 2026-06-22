# AnimeQ — desktop (Pytauri + PyInstaller) Makefile.
#
#   make setup   install bun + python deps (creates .venv)
#   make dev     run the desktop app with hot reload (Vite + Pytauri)
#   make build   build the frontend + bundle a macOS .app with PyInstaller
#   make run     open the built app
#   make clean   remove build artifacts

PYTHON ?= python3
VENV    := .venv
BIN     := $(VENV)/bin
PY      := $(BIN)/python
PIP     := $(BIN)/pip

# Default to the host platform spec. Override with: make build SPEC=animeq-windows.spec
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
DEFAULT_SPEC := animeq-macos.spec
else ifeq ($(OS),Windows_NT)
DEFAULT_SPEC := animeq-windows.spec
else
DEFAULT_SPEC := animeq-linux.spec
endif
SPEC    ?= $(DEFAULT_SPEC)

.PHONY: setup venv frontend build dev run clean help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup: bun-install venv ## Install all dependencies (JS + Python)
	@echo "✓ Setup complete. Run 'make dev' or 'make build'."

bun-install: ## Install JS dependencies
	bun install

venv: $(PY) ## Create the Python virtualenv and install Python deps

$(PY):
	$(PYTHON) -m venv $(VENV)
	$(PIP) install --upgrade pip setuptools wheel
	$(PIP) install -e python

frontend: ## Build the frontend into python/src/animeq/frontend
	bun run build

build: frontend ## Build the desktop app (.app / .exe) via PyInstaller
	$(PY) -m PyInstaller $(SPEC) --noconfirm
	@echo "✓ Build output in dist/"

dev: ## Run the desktop app in dev mode (Vite HMR + Pytauri)
	@export DEV_ENV=1 BUILD_MODE=dev PYTHONPATH=$(CURDIR)/python/src && \
	$(BIN)/jurigged -w $(CURDIR)/python/src -v -m animeq & \
	JID=$$!; bun run dev; kill $$JID 2>/dev/null || true

run: ## Open the most recently built app
	@if [ -d dist/AnimeQ.app ]; then open dist/AnimeQ.app; \
	elif [ -d dist/animeq-macos ]; then open dist/animeq-macos; \
	else echo "No build found. Run 'make build' first."; fi

clean: ## Remove build artifacts
	rm -rf build dist python/build python/dist
	rm -rf python/src/animeq/frontend
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
