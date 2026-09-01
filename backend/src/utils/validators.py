"""
Input validators - HARDENED
"""

import re
from typing import Dict, Any


def validate_form_url(url: str) -> bool:
    """Validate real Google Forms URL pattern"""
    # Correct pattern: https://docs.google.com/forms/d/[ID]/...
    pattern = r'^https://docs\.google\.com/forms/d/[a-zA-Z0-9_-]{20,}(/.*)?$'
    
    if not re.match(pattern, url):
        return False
    
    # Ensure it's actually google.com (prevent SSRF)
    if 'google.com' not in url or 'docs.google.com/forms' not in url:
        return False
    
    # Length check
    if len(url) > 500:
        return False
    
    return True


def validate_email(email: str) -> bool:
    """Validate email"""
    pattern = r'^[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,255}\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_form_data(data: Dict[str, Any]) -> bool:
    """Validate form response data"""
    if not isinstance(data, dict):
        return False
    
    # Max 500 fields
    if len(data) > 500:
        return False
    
    # Max 100KB total
    try:
        import json
        json_str = json.dumps(data)
        if len(json_str) > 100000:
            return False
        return True
    except (TypeError, ValueError):
        return False


def sanitize_input(text: str) -> str:
    """Remove dangerous characters"""
    if not isinstance(text, str):
        return str(text)
    
    text = text.strip()[:10000]
    
    # Remove control characters and dangerous chars
    dangerous = ['<', '>', '"', "'", '\\', '\x00', '\n', '\r', '{', '}', '$', '`']
    for char in dangerous:
        text = text.replace(char, '')
    
    return text
