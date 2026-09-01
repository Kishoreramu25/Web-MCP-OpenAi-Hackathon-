"""
Input validators
"""

import re
from typing import Dict, Any


def validate_form_url(url: str) -> bool:
    """Validate Google Form URL"""
    pattern = r'https://forms\.google\.com/.*'
    return bool(re.match(pattern, url))


def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_form_data(data: Dict[str, Any]) -> bool:
    """Validate form response data"""
    if not isinstance(data, dict):
        return False
    
    # Check if all values are serializable
    try:
        import json
        json.dumps(data)
        return True
    except (TypeError, ValueError):
        return False


def sanitize_input(text: str) -> str:
    """Sanitize user input"""
    if not isinstance(text, str):
        return str(text)
    
    # Remove potentially harmful characters
    text = text.strip()
    text = re.sub(r'[<>"\']', '', text)
    return text
