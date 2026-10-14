import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

_DLLS_INITIALIZED = False
_CACHED_CUDA_DIAGNOSTICS: Optional[Dict[str, Any]] = None


def setup_cuda_runtime_environment() -> Dict[str, Any]:
    """
    On Windows, register NVIDIA runtime DLL paths (cuBLAS, cuDNN, etc.)
    with both os.add_dll_directory() and os.environ["PATH"].
    This ensures CTranslate2 and Faster-Whisper can resolve cublas64_12.dll
    and cudnn64_9.dll at runtime without requiring a system-wide CUDA installation.
    """
    global _DLLS_INITIALIZED
    added_dirs: List[str] = []
    cublas_found = False
    cudnn_found = False

    if sys.platform == "win32":
        # 1. Inspect Python virtual environment / site-packages for nvidia wheels
        site_packages_candidates = []
        try:
            site_packages_candidates.append(Path(sys.executable).parent.parent / "Lib" / "site-packages" / "nvidia")
            site_packages_candidates.append(Path(sys.executable).parent / "Lib" / "site-packages" / "nvidia")
        except Exception:
            pass

        for sp_nvidia in site_packages_candidates:
            if sp_nvidia.is_dir():
                for sub in sp_nvidia.iterdir():
                    bin_dir = sub / "bin"
                    if bin_dir.is_dir():
                        bin_str = str(bin_dir)
                        try:
                            os.add_dll_directory(bin_str)
                            if bin_str not in added_dirs:
                                added_dirs.append(bin_str)
                            if bin_str not in os.environ.get("PATH", ""):
                                os.environ["PATH"] = bin_str + os.pathsep + os.environ.get("PATH", "")
                            
                            # Check specific key DLLs
                            if (bin_dir / "cublas64_12.dll").is_file():
                                cublas_found = True
                            if (bin_dir / "cudnn64_9.dll").is_file():
                                cudnn_found = True
                        except Exception:
                            pass

        # 2. Check system CUDA_PATH or standard NVIDIA toolkit directory if present
        cuda_path_env = os.environ.get("CUDA_PATH")
        toolkit_dirs = []
        if cuda_path_env:
            toolkit_dirs.append(Path(cuda_path_env) / "bin")

        program_files = os.environ.get("ProgramFiles", r"C:\Program Files")
        toolkit_base = Path(program_files) / "NVIDIA GPU Computing Toolkit" / "CUDA"
        if toolkit_base.is_dir():
            for ver_dir in toolkit_base.iterdir():
                bin_dir = ver_dir / "bin"
                if bin_dir.is_dir():
                    toolkit_dirs.append(bin_dir)

        for tk_bin in toolkit_dirs:
            if tk_bin.is_dir():
                tk_str = str(tk_bin)
                try:
                    os.add_dll_directory(tk_str)
                    if tk_str not in added_dirs:
                        added_dirs.append(tk_str)
                    if tk_str not in os.environ.get("PATH", ""):
                        os.environ["PATH"] = tk_str + os.pathsep + os.environ.get("PATH", "")
                    if any(tk_bin.glob("cublas64_*.dll")):
                        cublas_found = True
                    if any(tk_bin.glob("cudnn64_*.dll")):
                        cudnn_found = True
                except Exception:
                    pass

    _DLLS_INITIALIZED = True
    return {
        "dll_dirs_registered": added_dirs,
        "cublas_found": cublas_found,
        "cudnn_found": cudnn_found
    }


def get_nvidia_gpu_hardware_info() -> Dict[str, Any]:
    """Query NVIDIA driver and GPU identity via nvidia-smi."""
    gpu_detected = False
    gpu_name = None
    vram_total_mb = None
    driver_version = None

    # Check nvidia-smi CLI
    if shutil.which("nvidia-smi"):
        try:
            res = subprocess.run(
                ["nvidia-smi", "--query-gpu=name,memory.total,driver_version", "--format=csv,noheader,nounits"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=4
            )
            if res.returncode == 0 and res.stdout.strip():
                lines = [line.strip() for line in res.stdout.strip().splitlines() if line.strip()]
                if lines:
                    parts = [p.strip() for p in lines[0].split(",")]
                    if len(parts) >= 1:
                        gpu_name = parts[0]
                        gpu_detected = True
                    if len(parts) >= 2:
                        try:
                            vram_total_mb = int(float(parts[1]))
                        except ValueError:
                            pass
                    if len(parts) >= 3:
                        driver_version = parts[2]
        except Exception:
            pass

    return {
        "gpu_detected": gpu_detected,
        "gpu_name": gpu_name,
        "vram_total_mb": vram_total_mb,
        "driver_version": driver_version
    }


def get_cuda_runtime_diagnostics(refresh: bool = False) -> Dict[str, Any]:
    """
    Comprehensive diagnostics distinguishing:
    - GPU detected via NVIDIA driver
    - CTranslate2 installed
    - Faster-Whisper installed
    - CUDA inference device count
    - CUDA runtime libraries (cuBLAS / cuDNN) loaded
    - Supported compute types on CUDA
    """
    global _CACHED_CUDA_DIAGNOSTICS
    if _CACHED_CUDA_DIAGNOSTICS is not None and not refresh:
        return _CACHED_CUDA_DIAGNOSTICS

    # Initialize Windows DLL directories
    dll_status = setup_cuda_runtime_environment()
    hw_info = get_nvidia_gpu_hardware_info()

    ctranslate2_installed = False
    ctranslate2_version = None
    cuda_device_count = 0
    supported_compute_types_cuda: List[str] = []
    cuda_error: Optional[str] = None

    try:
        import ctranslate2
        ctranslate2_installed = True
        ctranslate2_version = getattr(ctranslate2, "__version__", "unknown")
        try:
            cuda_device_count = ctranslate2.get_cuda_device_count()
            if cuda_device_count > 0:
                supported_compute_types_cuda = sorted(list(ctranslate2.get_supported_compute_types("cuda")))
        except Exception as e:
            cuda_error = str(e)
    except ImportError:
        pass

    faster_whisper_installed = False
    try:
        import faster_whisper
        faster_whisper_installed = True
    except ImportError:
        pass

    cuda_inference_available = (
        hw_info["gpu_detected"]
        and ctranslate2_installed
        and cuda_device_count > 0
        and len(supported_compute_types_cuda) > 0
    )

    diagnostics = {
        "gpu_detected": hw_info["gpu_detected"],
        "gpu_name": hw_info["gpu_name"],
        "vram_total_mb": hw_info["vram_total_mb"],
        "driver_version": hw_info["driver_version"],
        "ctranslate2_installed": ctranslate2_installed,
        "ctranslate2_version": ctranslate2_version,
        "faster_whisper_installed": faster_whisper_installed,
        "cuda_device_count": cuda_device_count,
        "cuda_inference_available": cuda_inference_available,
        "supported_compute_types_cuda": supported_compute_types_cuda,
        "dll_runtime": dll_status,
        "cuda_error": cuda_error
    }

    _CACHED_CUDA_DIAGNOSTICS = diagnostics
    return diagnostics
