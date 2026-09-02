"""
Logging configuration
"""

import logging
import sys
from datetime import datetime


def setup_logger(name: str, level=logging.INFO):
    """Setup logger with consistent format and utf-8 safety"""
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    if not logger.handlers:
        if hasattr(sys.stdout, 'reconfigure'):
            try:
                sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')
            except Exception:
                pass
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            '[%(asctime)s] %(levelname)s - %(name)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    return logger
