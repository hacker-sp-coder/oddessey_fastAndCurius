import os
import re
from pathlib import Path
from typing import Tuple
from pypdf import PdfReader

def normalize_text(text: str) -> str:
    """Normalize whitespace and strip non-printable characters."""
    if not text:
        return ""
    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Replace multiple blank lines with double newline
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Strip trailing and leading whitespace
    return text.strip()

def extract_pdf_text(file_path: str) -> Tuple[bool, str, str]:
    """
    Extract readable text from a PDF file.
    Returns (success, text, error_message).
    """
    path = Path(file_path)
    if not path.is_file():
        return False, "", f"File does not exist: {file_path}"
    
    try:
        reader = PdfReader(str(path))
        extracted_pages = []
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text:
                extracted_pages.append(f"--- Page {i + 1} ---\n{page_text}")
        
        full_text = "\n\n".join(extracted_pages)
        normalized = normalize_text(full_text)
        
        if not normalized:
            return False, "", "PDF file did not yield readable text (it may be image-only/scanned without OCR)."
        
        return True, normalized, ""
    except Exception as e:
        return False, "", f"Failed to extract text from PDF: {str(e)}"

def extract_plain_text(file_path: str) -> Tuple[bool, str, str]:
    """
    Extract text from a TXT or Markdown file safely with UTF-8 or Latin-1 fallback.
    Returns (success, text, error_message).
    """
    path = Path(file_path)
    if not path.is_file():
        return False, "", f"File does not exist: {file_path}"
    
    content = ""
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
    except UnicodeDecodeError:
        try:
            with open(path, "r", encoding="latin-1") as f:
                content = f.read()
        except Exception as e:
            return False, "", f"Failed to decode text file: {str(e)}"
    except Exception as e:
        return False, "", f"Failed to read text file: {str(e)}"
    
    normalized = normalize_text(content)
    if not normalized:
        return False, "", "File is empty."
    
    return True, normalized, ""
