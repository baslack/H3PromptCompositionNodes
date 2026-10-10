"""Harness for the contract tests.

The package is loaded the way ComfyUI loads custom_nodes/<pkg>/__init__.py,
from a throwaway copy so nothing it writes lands in the checkout.
"""
from __future__ import annotations

import importlib.util
import ipaddress
import os
import shutil
import socket
import sys
import types
from pathlib import Path

import pytest
import torch

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = "h3_prompt_composition_contract"

comfyui_path = os.environ.get("COMFYUI_PATH")
if comfyui_path and comfyui_path not in sys.path:
    sys.path.insert(0, comfyui_path)

# Without CUDA (or with it hidden via CUDA_VISIBLE_DEVICES=-1), prime ComfyUI's
# CLI args with --cpu before anything imports comfy.model_management.
if comfyui_path and not torch.cuda.is_available():
    original_argv = sys.argv[:]
    try:
        sys.argv[:] = [original_argv[0], "--cpu"]
        import comfy.options

        comfy.options.enable_args_parsing()
        import comfy.cli_args  # noqa: F401
    finally:
        sys.argv[:] = original_argv

    import comfy_kitchen

    # Probing int8 attention queries a CUDA device and fails on CPU-only runs.
    comfy_kitchen.int8_attention_is_available = lambda: False

_real_connect = socket.socket.connect
_real_connect_ex = socket.socket.connect_ex


def _is_loopback(address) -> bool:
    host = address[0] if isinstance(address, tuple) else address
    if host == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


@pytest.fixture(autouse=True)
def _no_network(monkeypatch):
    """Nothing in this package may reach the network."""

    def connect(self, address):
        if not _is_loopback(address):
            raise RuntimeError(f"tests must not open network connections (attempted {address!r})")
        return _real_connect(self, address)

    def connect_ex(self, address):
        if not _is_loopback(address):
            raise RuntimeError(f"tests must not open network connections (attempted {address!r})")
        return _real_connect_ex(self, address)

    monkeypatch.setattr(socket.socket, "connect", connect)
    monkeypatch.setattr(socket.socket, "connect_ex", connect_ex)


@pytest.fixture(scope="session")
def ext(tmp_path_factory):
    """namespace(pkg, root): the loaded package and its copy on disk."""
    pytest.importorskip("folder_paths", reason="set COMFYUI_PATH to a ComfyUI checkout")
    root = tmp_path_factory.mktemp("custom_nodes") / "H3PromptCompositionNodes"
    shutil.copytree(ROOT, root, ignore=shutil.ignore_patterns(".git", "tests", "Workflow", "__pycache__", ".pytest_cache"))
    spec = importlib.util.spec_from_file_location(PACKAGE, root / "__init__.py", submodule_search_locations=[str(root)])
    module = importlib.util.module_from_spec(spec)
    sys.modules[PACKAGE] = module
    spec.loader.exec_module(module)
    return types.SimpleNamespace(pkg=module, root=root)
