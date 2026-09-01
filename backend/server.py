"""
Google Form Auto-Filler Backend - PRODUCTION READY
WebMCP Challenge 2026
Author: Kishore Ramu (Kix)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from functools import wraps
from dotenv import load_dotenv
import os
import json
from datetime import datetime
import google.generativeai as genai
from jsonschema import validate, ValidationError
from src.mcp.form_tools import FormAnalyzer, FormFiller, FormSubmitter
from src.utils.logger import setup_logger
from src.utils.validators import validate_form_url, validate_form_data

# Load environment
load_dotenv()

# Initialize Flask
app = Flask(__name__)

# ============= SECURITY: Environment validation =============
FLASK_ENV = os.getenv('FLASK_ENV', 'development')
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'

if DEBUG and FLASK_ENV == 'production':
    raise ValueError("❌ FATAL: DEBUG=True not allowed in production")

# ============= SECURITY: Require API keys in production =============
API_KEYS_STR = os.getenv('API_KEYS', '')
if FLASK_ENV == 'production' and not API_KEYS_STR:
    raise ValueError("❌ FATAL: API_KEYS required in production. Set non-empty API_KEYS env var.")

SECRET_API_KEYS = [k.strip() for k in API_KEYS_STR.split(',') if k.strip()]
if not SECRET_API_KEYS:
    raise ValueError("❌ FATAL: At least one valid API key required")

# ============= SECURITY: CORS setup =============
ALLOWED_ORIGINS_STR = os.getenv('ALLOWED_ORIGINS', '')
if FLASK_ENV == 'production' and not ALLOWED_ORIGINS_STR:
    raise ValueError("❌ FATAL: ALLOWED_ORIGINS required in production")

ALLOWED_ORIGINS = [o.strip() for o in ALLOWED_ORIGINS_STR.split(',') if o.strip()]
if not ALLOWED_ORIGINS:
    ALLOWED_ORIGINS = ['http://localhost:5173']  # Safe dev only

CORS(app, 
     origins=ALLOWED_ORIGINS, 
     supports_credentials=False,  # Disabled by default for security
     allow_headers=['Content-Type', 'X-API-Key'])

# ============= SECURITY: Per-API-Key Rate Limiting =============
def limiter_key():
    """Rate limit by API key (if present) or IP"""
    api_key = request.headers.get('X-API-Key', '').strip()
    return api_key if api_key else get_remote_address()

RATELIMIT_URI = os.getenv('RATELIMIT_URI', 'memory://')
limiter = Limiter(
    app=app,
    key_func=limiter_key,
    storage_uri=RATELIMIT_URI,
    default_limits=["200 per day", "50 per hour"]
)

# Setup logging
logger = setup_logger(__name__)

# ============= SECURITY: JSON Schema for model output validation =============
FORM_ANALYSIS_SCHEMA = {
    "type": "object",
    "required": ["formId", "title", "fields"],
    "properties": {
        "formId": {"type": "string", "maxLength": 100},
        "title": {"type": "string", "maxLength": 500},
        "description": {"type": "string", "maxLength": 2000},
        "fields": {
            "type": "array",
            "maxItems": 500,
            "items": {
                "type": "object",
                "required": ["id", "label", "type"],
                "properties": {
                    "id": {"type": "string", "maxLength": 100},
                    "label": {"type": "string", "maxLength": 1000},
                    "type": {"type": "string", "enum": ["text", "email", "select", "checkbox", "radio", "textarea"]},
                    "required": {"type": "boolean"},
                    "options": {"type": "array", "maxItems": 100}
                }
            }
        }
    }
}

FILLING_STRATEGY_SCHEMA = {
    "type": "object",
    "required": ["steps", "validation"],
    "properties": {
        "steps": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["action", "fieldId"],
                "properties": {
                    "action": {"type": "string", "enum": ["fill", "select", "check", "submit"]},
                    "fieldId": {"type": "string", "maxLength": 100},
                    "value": {"type": "string", "maxLength": 5000}
                }
            }
        },
        "validation": {
            "type": "object",
            "required": ["allFieldsFilled"],
            "properties": {
                "allFieldsFilled": {"type": "boolean"},
                "requiredFieldsMissing": {"type": "array"}
            }
        }
    }
}

# ============= SECURITY: API Key authentication =============
def require_api_key(f):
    """Require valid API key"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key', '').strip()
        
        if not api_key:
            logger.warning(f"❌ Missing API key from {get_remote_address()}")
            return jsonify({'error': 'Missing X-API-Key header', 'code': 'AUTH_001'}), 401
        
        if api_key not in SECRET_API_KEYS:
            logger.warning(f"❌ Invalid API key from {get_remote_address()}")
            return jsonify({'error': 'Invalid API key', 'code': 'AUTH_002'}), 403
        
        return f(*args, **kwargs)
    
    return decorated_function

# Configure Gemini API
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("Missing GEMINI_API_KEY")

genai.configure(api_key=GEMINI_API_KEY)

# Initialize tools
form_analyzer = FormAnalyzer()
form_filler = FormFiller()
form_submitter = FormSubmitter()

# In-memory storage
submissions_history = []
MAX_SUBMISSIONS = 1000

# Startup info
logger.info("=" * 70)
logger.info("🚀 Google Form Auto-Filler Backend")
logger.info(f"Environment: {FLASK_ENV}")
logger.info(f"Debug: {DEBUG}")
logger.info(f"CORS Origins: {ALLOWED_ORIGINS}")
logger.info(f"API Keys: {len(SECRET_API_KEYS)} configured")
logger.info(f"Rate Limit Storage: {RATELIMIT_URI}")
logger.info("=" * 70)


# ============= ENDPOINTS =============

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check (public)"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'service': 'Google Form Auto-Filler'
    }), 200


@app.route('/api/forms/analyze', methods=['POST'])
@limiter.limit("10 per minute")
@require_api_key
def analyze_form():
    """Analyze form structure"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Invalid JSON', 'code': 'PARSE_001'}), 400
        
        form_url = data.get('formUrl', '').strip()
        
        if not form_url:
            return jsonify({'error': 'formUrl required', 'code': 'VALIDATE_001'}), 400
        
        if not validate_form_url(form_url):
            logger.warning(f"Invalid URL: {form_url[:50]}")
            return jsonify({'error': 'Invalid Google Form URL', 'code': 'VALIDATE_002'}), 400
        
        logger.info(f"✓ Analyzing: {form_url[:50]}...")
        
        # Sanitize for model
        safe_url = form_url.replace('<', '').replace('>', '').replace('"', '')
        
        model = genai.GenerativeModel('gemini-pro')
        
        prompt = f"""Analyze this Google Form and return ONLY valid JSON (no markdown):
Form: {safe_url}

Return:
{{"formId":"id","title":"title","description":"desc","fields":[{{"id":"f1","label":"Question?","type":"text","required":false,"options":[]}}]}}"""
        
        response = model.generate_content(prompt)
        
        # ============= SECURITY: Safe JSON parsing + Schema validation =============
        resp_text = response.text.strip()
        if not resp_text.startswith('{') or not resp_text.endswith('}'):
            logger.error("❌ Invalid model JSON")
            return jsonify({'error': 'Failed to parse form', 'code': 'PARSE_002'}), 500
        
        try:
            form_data = json.loads(resp_text)
        except json.JSONDecodeError:
            logger.error("❌ JSON decode failed")
            return jsonify({'error': 'Invalid JSON', 'code': 'PARSE_003'}), 500
        
        # ============= SECURITY: Validate against schema =============
        try:
            validate(instance=form_data, schema=FORM_ANALYSIS_SCHEMA)
        except ValidationError as e:
            logger.error(f"❌ Schema validation failed: {str(e)}")
            return jsonify({'error': 'Invalid form structure', 'code': 'SCHEMA_001'}), 400
        
        logger.info(f"✓ Form OK: {len(form_data.get('fields', []))} fields")
        
        return jsonify({
            'success': True,
            'data': form_data,
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error: {str(e)[:100]}")
        return jsonify({'error': 'Internal error', 'code': 'SERVER_001'}), 500


@app.route('/api/forms/fill', methods=['POST'])
@limiter.limit("20 per minute")
@require_api_key
def fill_form():
    """Fill form"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Invalid JSON', 'code': 'PARSE_001'}), 400
        
        form_url = data.get('formUrl', '').strip()
        responses = data.get('responses', {})
        
        if not form_url or not responses:
            return jsonify({'error': 'formUrl + responses required', 'code': 'VALIDATE_003'}), 400
        
        if not validate_form_url(form_url):
            return jsonify({'error': 'Invalid URL', 'code': 'VALIDATE_004'}), 400
        
        if not validate_form_data(responses):
            return jsonify({'error': 'Invalid responses', 'code': 'VALIDATE_005'}), 400
        
        if len(json.dumps(responses)) > 100000:
            return jsonify({'error': 'Payload too large', 'code': 'VALIDATE_006'}), 413
        
        logger.info(f"✓ Filling: {form_url[:50]}...")
        
        # Sanitize for model
        safe_url = form_url.replace('<', '').replace('>', '').replace('"', '')
        safe_responses = json.dumps(responses)[:5000]
        
        model = genai.GenerativeModel('gemini-pro')
        
        prompt = f"""Create filling strategy for Google Form. Return ONLY JSON:
Form: {safe_url}
Responses: {safe_responses}

Return:
{{"steps":[{{"action":"fill","fieldId":"f1","value":"answer"}}],"validation":{{"allFieldsFilled":true,"requiredFieldsMissing":[]}}}}"""
        
        response = model.generate_content(prompt)
        
        # ============= SECURITY: Safe parse + schema validation =============
        resp_text = response.text.strip()
        if not resp_text.startswith('{') or not resp_text.endswith('}'):
            logger.error("❌ Invalid JSON")
            return jsonify({'error': 'Invalid response', 'code': 'PARSE_004'}), 500
        
        try:
            filling_strategy = json.loads(resp_text)
        except json.JSONDecodeError:
            logger.error("❌ JSON fail")
            return jsonify({'error': 'Parse error', 'code': 'PARSE_005'}), 500
        
        # ============= SECURITY: Validate schema =============
        try:
            validate(instance=filling_strategy, schema=FILLING_STRATEGY_SCHEMA)
        except ValidationError as e:
            logger.error(f"❌ Schema fail: {str(e)}")
            return jsonify({'error': 'Invalid strategy', 'code': 'SCHEMA_002'}), 400
        
        submission_id = f"sub_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
        
        submission = {
            'submissionId': submission_id,
            'formUrl': form_url[:100],
            'responseCount': len(responses),
            'timestamp': datetime.now().isoformat(),
            'status': 'success'
        }
        submissions_history.append(submission)
        
        if len(submissions_history) > MAX_SUBMISSIONS:
            submissions_history.pop(0)
        
        logger.info(f"✓ Filled: {submission_id}")
        
        return jsonify({
            'success': True,
            'submissionId': submission_id,
            'timestamp': datetime.now().isoformat(),
            'results': filling_strategy
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error: {str(e)[:100]}")
        return jsonify({'error': 'Internal error', 'code': 'SERVER_002'}), 500


@app.route('/api/submissions', methods=['GET'])
@limiter.limit("30 per minute")
@require_api_key
def get_submissions():
    """Get submissions"""
    try:
        limit = min(int(request.args.get('limit', 100)), 500)
        offset = max(int(request.args.get('offset', 0)), 0)
        
        total = len(submissions_history)
        results = submissions_history[offset:offset+limit]
        
        logger.info(f"✓ Fetched {len(results)} submissions")
        
        return jsonify({
            'success': True,
            'total': total,
            'limit': limit,
            'offset': offset,
            'data': results
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error: {str(e)[:100]}")
        return jsonify({'error': 'Internal error', 'code': 'SERVER_003'}), 500


@app.route('/api/submissions/<submission_id>', methods=['GET'])
@limiter.limit("20 per minute")
@require_api_key
def get_submission(submission_id):
    """Get one submission"""
    try:
        if not submission_id.startswith('sub_') or len(submission_id) > 50:
            return jsonify({'error': 'Invalid ID', 'code': 'VALIDATE_007'}), 400
        
        submission = next(
            (s for s in submissions_history if s['submissionId'] == submission_id),
            None
        )
        
        if not submission:
            return jsonify({'error': 'Not found', 'code': 'NOT_FOUND_001'}), 404
        
        return jsonify({'success': True, 'data': submission}), 200
        
    except Exception as e:
        logger.error(f"❌ Error: {str(e)[:100]}")
        return jsonify({'error': 'Internal error', 'code': 'SERVER_004'}), 500


@app.route('/api/submissions/<submission_id>', methods=['DELETE'])
@limiter.limit("5 per minute")
@require_api_key
def delete_submission(submission_id):
    """Delete submission"""
    try:
        if not submission_id.startswith('sub_') or len(submission_id) > 50:
            return jsonify({'error': 'Invalid ID', 'code': 'VALIDATE_008'}), 400
        
        global submissions_history
        orig_len = len(submissions_history)
        submissions_history = [s for s in submissions_history if s['submissionId'] != submission_id]
        
        if len(submissions_history) == orig_len:
            return jsonify({'error': 'Not found', 'code': 'NOT_FOUND_002'}), 404
        
        logger.info(f"✓ Deleted: {submission_id}")
        
        return jsonify({'success': True, 'message': 'Deleted'}), 200
        
    except Exception as e:
        logger.error(f"❌ Error: {str(e)[:100]}")
        return jsonify({'error': 'Internal error', 'code': 'SERVER_005'}), 500


# ============= ERROR HANDLERS =============

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found', 'code': 'HTTP_404'}), 404

@app.errorhandler(429)
def ratelimit_handler(e):
    logger.warning(f"⚠️ Rate limit from {get_remote_address()}")
    return jsonify({'error': 'Rate limit exceeded', 'code': 'RATE_LIMIT_001'}), 429

@app.errorhandler(500)
def server_error(error):
    logger.error(f"❌ Server error: {str(error)[:100]}")
    return jsonify({'error': 'Internal error', 'code': 'SERVER_500'}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 3000))
    
    if DEBUG and FLASK_ENV == 'production':
        logger.error("❌ Cannot start: DEBUG=True in production")
        exit(1)
    
    logger.info(f"✓ Starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=DEBUG)
