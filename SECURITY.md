# Security Policy

## Vulnerability Disclosure

If you discover a security vulnerability, email **ramkisho28@gmail.com**

## Security Features

### Authentication
- All protected endpoints require `X-API-Key` header
- API keys environment-variable-based

### Rate Limiting
- `/analyze` - 10 req/min
- `/fill` - 20 req/min  
- `/delete` - 5 req/min

### Input Validation
- Strict Google Forms URL validation
- Response size limits (100KB max)
- Type checking on all inputs

### CORS
- Restricted to configured origins
- Credentials disabled

### Environment
- Debug disabled in production
- All secrets in env vars
