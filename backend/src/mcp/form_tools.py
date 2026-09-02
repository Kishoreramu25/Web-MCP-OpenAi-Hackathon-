"""
MCP Form Tools - WebMCP Integration
"""

import json
import re
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


from bs4 import BeautifulSoup

class FormAnalyzer:
    """Analyze Google Form structure"""
    
    def __init__(self):
        self.form_id_pattern = r'(?:/forms/(?:u/\d+/)?d/(?:e/)?|forms\.gle/)([a-zA-Z0-9-_]+)'
    
    def extract_form_id(self, url: str) -> Optional[str]:
        """Extract form ID from Google Form URL"""
        match = re.search(self.form_id_pattern, url)
        return match.group(1) if match else None
    
    def parse_form_structure(self, html: str) -> Dict:
        """Parse form HTML and extract fields"""
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Extract form title
            title = 'Google Form'
            title_elem = soup.find('div', class_=re.compile(r'.*HeaderTitle.*')) or soup.find('title')
            if title_elem:
                title = title_elem.get_text().strip()
                title = re.sub(r'\s*-\s*Google Forms$', '', title)
            
            # Extract description
            desc_elem = soup.find('div', class_=re.compile(r'.*HeaderDescription.*|.*freebirdFormviewerViewHeaderDescription.*'))
            description = desc_elem.get_text().strip() if desc_elem else ''
            
            fields = []
            
            # 1. Try FB_PUBLIC_LOAD_DATA_
            match = re.search(r'var FB_PUBLIC_LOAD_DATA_\s*=\s*(\[.+?\]);(?:\s*var\s|\s*</script>)', html, re.DOTALL)
            if match:
                try:
                    data = json.loads(match.group(1))
                    questions = data[1][1] if len(data) > 1 and data[1] and len(data[1]) > 1 else []
                    for q in questions:
                        if not q or len(q) < 4 or not q[1]:
                            continue
                        label = q[1]
                        type_code = q[3]
                        type_map = {0: 'text', 1: 'textarea', 2: 'radio', 3: 'select', 4: 'checkbox', 5: 'select', 7: 'select'}
                        field_type = type_map.get(type_code, 'text')
                        if 'email' in label.lower():
                            field_type = 'email'
                        
                        entry_id = f"field_{len(fields) + 1}"
                        options = []
                        required = False
                        
                        if len(q) > 4 and q[4] and len(q[4]) > 0 and q[4][0]:
                            entry_meta = q[4][0]
                            if len(entry_meta) > 0 and entry_meta[0]:
                                entry_id = f"entry.{entry_meta[0]}"
                            if len(entry_meta) > 1 and entry_meta[1]:
                                options = [opt[0] for opt in entry_meta[1] if opt and len(opt) > 0 and opt[0]]
                            if len(entry_meta) > 2:
                                required = bool(entry_meta[2])
                                
                        fields.append({
                            'id': entry_id,
                            'label': label,
                            'type': field_type,
                            'required': required,
                            'options': options
                        })
                except Exception as e:
                    logger.warning(f"Failed to parse FB_PUBLIC_LOAD_DATA_: {e}")
            
            # 2. Fallback to DOM elements if needed
            if not fields:
                items = soup.find_all('div', role='listitem') or soup.find_all('div', class_=re.compile(r'geS5n|freebirdFormviewerViewNumberedItemContainer'))
                for i, item in enumerate(items):
                    title_elem = item.find(role='heading') or item.find('span', class_=re.compile(r'M7eMe|freebirdFormviewerComponentsQuestionBaseTitle'))
                    if not title_elem:
                        continue
                    label = title_elem.get_text().strip()
                    req_star = item.find('span', class_=re.compile(r'freebirdFormviewerComponentsQuestionBaseRequiredAsterisk|v3Yvs'))
                    required = bool(req_star)
                    
                    field_type = 'text'
                    if item.find('textarea'):
                        field_type = 'textarea'
                    elif item.find('div', role='radiogroup') or item.find('div', role='radio'):
                        field_type = 'radio'
                    elif item.find('div', role='checkbox') or item.find('input', type='checkbox'):
                        field_type = 'checkbox'
                    elif item.find('div', role='listbox'):
                        field_type = 'select'
                    elif 'email' in label.lower():
                        field_type = 'email'
                    
                    options = []
                    for opt in item.find_all('span', dir='auto') or item.find_all('div', role='radio'):
                        opt_text = opt.get_text().strip()
                        if opt_text and opt_text != label and opt_text not in options and len(opt_text) < 100:
                            options.append(opt_text)
                    
                    fields.append({
                        'id': f"f{i+1}",
                        'label': label,
                        'type': field_type,
                        'required': required,
                        'options': options
                    })
            
            return {
                'formId': 'extracted_id',
                'title': title,
                'description': description,
                'fields': fields
            }
        except Exception as e:
            logger.error(f"Error parsing form: {str(e)}")
            return {
                'formId': 'unknown',
                'title': 'Google Form',
                'description': '',
                'fields': []
            }


class FormFiller:
    """Fill form fields intelligently"""
    
    def __init__(self):
        self.field_types = ['text', 'email', 'select', 'checkbox', 'radio', 'textarea']
    
    def match_response_to_field(self, field: Dict, response: str) -> str:
        """Intelligently match response to field type"""
        field_type = field.get('type', 'text')
        
        if field_type == 'email':
            return self._validate_email(response)
        elif field_type in ['select', 'radio']:
            return self._find_best_option(field, response)
        elif field_type == 'checkbox':
            return self._handle_checkbox(response)
        else:
            return str(response)
    
    def _validate_email(self, email: str) -> str:
        """Validate email format"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return email if re.match(pattern, email) else ''
    
    def _find_best_option(self, field: Dict, response: str) -> str:
        """Find closest matching option"""
        options = field.get('options', [])
        if not options:
            return response
        
        # Simple matching logic
        for option in options:
            if option.lower() == response.lower():
                return option
        
        return options[0] if options else response
    
    def _handle_checkbox(self, response: str) -> bool:
        """Handle checkbox responses"""
        return response.lower() in ['yes', 'true', '1', 'on']
    
    def generate_filling_steps(self, form_data: Dict, responses: Dict) -> List[Dict]:
        """Generate steps to fill form"""
        steps = []
        
        for field in form_data.get('fields', []):
            field_id = field.get('id')
            field_label = field.get('label')
            
            # Find matching response
            response = responses.get(field_id) or responses.get(field_label)
            
            if response:
                value = self.match_response_to_field(field, response)
                steps.append({
                    'action': 'fill',
                    'fieldId': field_id,
                    'value': value
                })
        
        # Add submit step
        steps.append({
            'action': 'submit',
            'fieldId': None,
            'value': None
        })
        
        return steps


class FormSubmitter:
    """Submit forms"""
    
    def __init__(self):
        self.submission_status = None
    
    def validate_submission(self, form_data: Dict, filled_values: Dict) -> Dict:
        """Validate all required fields are filled"""
        required_fields = [
            f for f in form_data.get('fields', [])
            if f.get('required', False)
        ]
        
        missing = [
            f['id'] for f in required_fields
            if not filled_values.get(f['id'])
        ]
        
        return {
            'isValid': len(missing) == 0,
            'missingFields': missing
        }
    
    def submit(self, form_data: Dict, filled_values: Dict) -> Dict:
        """Submit form"""
        validation = self.validate_submission(form_data, filled_values)
        
        if not validation['isValid']:
            return {
                'success': False,
                'error': f"Missing required fields: {validation['missingFields']}"
            }
        
        return {
            'success': True,
            'submissionTime': None,
            'confirmationCode': None
        }
