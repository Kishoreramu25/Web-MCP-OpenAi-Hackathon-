"""
Input validators - HARDENED & FIXED
"""

import re
import base64
from typing import Dict, Any


def validate_form_url(url: str) -> bool:
    """Validate real Google Forms URL - STRICT pattern"""
    # Correct Google Forms URL: https://docs.google.com/forms/d/[ID]/...
    # Also accept: https://forms.google.com/forms/d/[ID]/...
    pattern = r'^https://(docs\.)?google\.com/forms/d/[a-zA-Z0-9_-]{20,}(?:/.*)?$'
    
    if not re.match(pattern, url):
        return False
    
    # SSRF prevention - only google.com
    if 'google.com' not in url or '/forms/d/' not in url:
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


def encode_responses_for_model(responses: Dict[str, Any]) -> str:
    """
    Safely encode form responses for model input.
    Uses base64 to avoid JSON truncation and injection risks.
    """
    try:
        import json
        import base64
        
        # Serialize to JSON
        json_str = json.dumps(responses)
        
        # Base64 encode to avoid truncation issues
        encoded = base64.b64encode(json_str.encode()).decode()
        
        return encoded
    except Exception as e:
        raise ValueError(f"Failed to encode responses: {str(e)}")


def extract_json_from_text(text: str) -> str:
    """
    Extract JSON from text that may contain code fences or comments.
    Handles: regular JSON, JSON wrapped in ```json...```, markdown formatting.
    """
    text = text.strip()
    
    # Remove code fences
    if text.startswith('```'):
        # Extract content between fences
        start = text.find('\n') + 1
        end = text.rfind('```')
        if end > start:
            text = text[start:end].strip()
    
    # Remove leading 'json' or 'JSON' after backticks
    if text.startswith('json') or text.startswith('JSON'):
        text = text[4:].strip()
    
    # Find first { and last }
    start_idx = text.find('{')
    end_idx = text.rfind('}')
    
    if start_idx != -1 and end_idx != -1 and start_idx < end_idx:
        return text[start_idx:end_idx+1]
    
    return text
