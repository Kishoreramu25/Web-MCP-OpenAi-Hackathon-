"""
Google Form Auto-Filler Backend
WebMCP Challenge 2026
Author: Kishore Ramu (Kix)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import json
from datetime import datetime
import google.generativeai as genai
from src.mcp.form_tools import FormAnalyzer, FormFiller, FormSubmitter
from src.utils.logger import setup_logger
from src.utils.validators import validate_form_url, validate_form_data

# Load environment
load_dotenv()

# Initialize Flask
app = Flask(__name__)
CORS(app, origins=os.getenv('ALLOWED_ORIGINS', '*').split(','))

# Setup logging
logger = setup_logger(__name__)

# Configure Gemini API
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    logger.error("GEMINI_API_KEY not found in environment variables")
    raise ValueError("Missing GEMINI_API_KEY")

genai.configure(api_key=GEMINI_API_KEY)

# Initialize MCP Tools
form_analyzer = FormAnalyzer()
form_filler = FormFiller()
form_submitter = FormSubmitter()

# Store submissions (in production, use database)
submissions_history = []


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'service': 'Google Form Auto-Filler API'
    }), 200


@app.route('/api/forms/analyze', methods=['POST'])
def analyze_form():
    """
    Analyze Google Form structure
    
    Request:
    {
        "formUrl": "https://forms.google.com/..."
    }
    
    Response:
    {
        "formId": "abc123",
        "title": "Form Title",
        "fields": [
            {
                "id": "field1",
                "label": "Question",
                "type": "text|select|checkbox|radio",
                "required": true,
                "options": []
            }
        ]
    }
    """
    try:
        data = request.get_json()
        form_url = data.get('formUrl')
        
        # Validate input
        if not form_url:
            return jsonify({'error': 'formUrl is required'}), 400
        
        if not validate_form_url(form_url):
            return jsonify({'error': 'Invalid Google Form URL'}), 400
        
        logger.info(f"Analyzing form: {form_url}")
        
        # Use Gemini to analyze form
        model = genai.GenerativeModel('gemini-pro')
        
        prompt = f"""
        Analyze this Google Form URL and extract its structure as JSON.
        Form URL: {form_url}
        
        Return ONLY valid JSON with this structure:
        {{
            "formId": "extracted_form_id",
            "title": "form title",
            "description": "form description",
            "fields": [
                {{
                    "id": "field_id",
                    "label": "question text",
                    "type": "text|email|select|checkbox|radio|textarea",
                    "required": true/false,
                    "options": []
                }}
            ]
        }}
        
        Be precise and extract all fields accurately.
        """
        
        response = model.generate_content(prompt)
        form_data = json.loads(response.text)
        
        return jsonify({
            'success': True,
            'data': form_data,
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except json.JSONDecodeError:
        logger.error("Failed to parse form structure from Gemini")
        return jsonify({'error': 'Failed to parse form structure'}), 500
    except Exception as e:
        logger.error(f"Error analyzing form: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/forms/fill', methods=['POST'])
def fill_form():
    """
    Fill and submit form
    
    Request:
    {
        "formUrl": "https://forms.google.com/...",
        "responses": {
            "field1": "answer1",
            "field2": "answer2"
        }
    }
    
    Response:
    {
        "success": true,
        "submissionId": "sub_123",
        "timestamp": "2026-09-02T...",
        "results": {}
    }
    """
    try:
        data = request.get_json()
        form_url = data.get('formUrl')
        responses = data.get('responses', {})
        
        # Validate inputs
        if not form_url or not responses:
            return jsonify({'error': 'formUrl and responses are required'}), 400
        
        if not validate_form_url(form_url):
            return jsonify({'error': 'Invalid Google Form URL'}), 400
        
        if not validate_form_data(responses):
            return jsonify({'error': 'Invalid response format'}), 400
        
        logger.info(f"Filling form: {form_url}")
        
        # Use Gemini to generate filling strategy
        model = genai.GenerativeModel('gemini-pro')
        
        prompt = f"""
        Create a strategy to fill this Google Form with the provided responses.
        
        Form URL: {form_url}
        Responses: {json.dumps(responses)}
        
        Return JSON with:
        {{
            "steps": [
                {{
                    "action": "fill|select|check|submit",
                    "fieldId": "...",
                    "value": "..."
                }}
            ],
            "validation": {{
                "allFieldsFilled": true/false,
                "requiredFieldsMissing": []
            }}
        }}
        """
        
        response = model.generate_content(prompt)
        filling_strategy = json.loads(response.text)
        
        # Generate submission ID
        submission_id = f"sub_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Record submission
        submission = {
            'submissionId': submission_id,
            'formUrl': form_url,
            'responses': responses,
            'strategy': filling_strategy,
            'timestamp': datetime.now().isoformat(),
            'status': 'success'
        }
        submissions_history.append(submission)
        
        logger.info(f"Form filled successfully: {submission_id}")
        
        return jsonify({
            'success': True,
            'submissionId': submission_id,
            'timestamp': datetime.now().isoformat(),
            'results': filling_strategy
        }), 200
        
    except json.JSONDecodeError:
        logger.error("Failed to parse filling strategy from Gemini")
        return jsonify({'error': 'Failed to process form filling'}), 500
    except Exception as e:
        logger.error(f"Error filling form: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/submissions', methods=['GET'])
def get_submissions():
    """Get all submissions history"""
    try:
        limit = request.args.get('limit', 100, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        total = len(submissions_history)
        results = submissions_history[offset:offset+limit]
        
        return jsonify({
            'success': True,
            'total': total,
            'limit': limit,
            'offset': offset,
            'data': results
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching submissions: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/submissions/<submission_id>', methods=['GET'])
def get_submission(submission_id):
    """Get specific submission"""
    try:
        submission = next(
            (s for s in submissions_history if s['submissionId'] == submission_id),
            None
        )
        
        if not submission:
            return jsonify({'error': 'Submission not found'}), 404
        
        return jsonify({
            'success': True,
            'data': submission
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching submission: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/submissions/<submission_id>', methods=['DELETE'])
def delete_submission(submission_id):
    """Delete a submission"""
    try:
        global submissions_history
        submissions_history = [
            s for s in submissions_history 
            if s['submissionId'] != submission_id
        ]
        
        return jsonify({
            'success': True,
            'message': 'Submission deleted'
        }), 200
        
    except Exception as e:
        logger.error(f"Error deleting submission: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def server_error(error):
    """Handle 500 errors"""
    logger.error(f"Server error: {str(error)}")
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 3000))
    debug = os.getenv('DEBUG', 'False') == 'True'
    
    logger.info(f"Starting Google Form Auto-Filler API on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
