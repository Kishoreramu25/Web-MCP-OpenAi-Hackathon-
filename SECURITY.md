# 🔒 Security Policy

## Vulnerability Disclosure

Found a security issue? Email: **ramkisho28@gmail.com**

Do NOT open public issues for security vulnerabilities.

---

## ✅ Security Features Implemented

### 1. **Authentication (API Key Based)**
- ✅ All protected endpoints require `X-API-Key` header
- ✅ Invalid keys return 403 Forbidden
- ✅ Missing keys return 401 Unauthorized
- ✅ Keys stored in environment variables only

**Usage:**
```bash
curl -H "X-API-Key: your-key" http://api/endpoint
```

### 2. **Rate Limiting**
- ✅ `/analyze` - 10 requests/minute per IP
- ✅ `/fill` - 20 requests/minute per IP
- ✅ `/delete` - 5 requests/minute per IP
- ✅ Default - 200/day, 50/hour per IP
- ✅ Returns 429 when exceeded

### 3. **Input Validation**
- ✅ URL pattern validation (docs.google.com/forms/d/[ID])
- ✅ SSRF prevention (only google.com allowed)
- ✅ Payload size limits (100KB max)
- ✅ Field count limits (500 max)
- ✅ Type checking on all inputs

### 4. **Output Safety**
- ✅ JSON parsing is safe (validates structure before parsing)
- ✅ Model output treated as untrusted
- ✅ Error responses don't leak internals
- ✅ No arbitrary code execution

### 5. **CORS**
- ✅ Restricted to configured origins only
- ✅ Default: `http://localhost:5173` (dev only)
- ✅ Production: Must explicitly set ALLOWED_ORIGINS
- ✅ Fails startup if missing in production

### 6. **Production Safety**
- ✅ Debug mode disabled by default
- ✅ Startup fails if DEBUG=True in production
- ✅ FLASK_ENV=production required for strict mode
- ✅ All secrets in environment variables

### 7. **Logging & Monitoring**
- ✅ Failed auth attempts logged
- ✅ Rate limit violations logged
- ✅ Invalid inputs logged
- ✅ No sensitive data in logs

---

## 🔧 Configuration

### Minimal Safe Setup (Production)

```bash
export FLASK_ENV=production
export DEBUG=False
export GEMINI_API_KEY=sk-xxxx
export API_KEYS=your-secure-key-1,your-secure-key-2
export ALLOWED_ORIGINS=https://app.example.com
export PORT=3000
python server.py
```

### Development Setup

```bash
export FLASK_ENV=development
export DEBUG=False  # Keep False even in dev
export GEMINI_API_KEY=sk-xxxx
export API_KEYS=dev-key-12345
export ALLOWED_ORIGINS=http://localhost:5173
python server.py
```

---

## ⚠️ Security Checklist Before Deployment

- [ ] `DEBUG=False` set in production
- [ ] `FLASK_ENV=production` set
- [ ] `ALLOWED_ORIGINS` explicitly configured
- [ ] `API_KEYS` are strong and unique
- [ ] No `.env` file in Git (add to `.gitignore`)
- [ ] Secrets stored in secure management (AWS Secrets Manager, etc.)
- [ ] HTTPS enforced on all endpoints
- [ ] Rate limits appropriate for your scale
- [ ] Database used instead of in-memory storage
- [ ] Monitoring and alerts configured

---

## 🚀 Best Practices for Users

1. **Store secrets securely**
   - Use AWS Secrets Manager, HashiCorp Vault, or similar
   - Never commit `.env` files
   - Rotate keys regularly

2. **Use strong API keys**
   - Min 32 characters, alphanumeric + symbols
   - Generate per deployment/environment
   - Store one per service

3. **Monitor usage**
   - Watch for unusual API activity
   - Set rate limits for your scale
   - Track Gemini API costs

4. **Update dependencies**
   - Run `pip install -U -r requirements.txt` monthly
   - Use `pip-audit` to check for vulnerabilities

5. **Report issues**
   - Contact security team (see above)
   - Allow 30 days before public disclosure
   - Include reproduction steps

---

## 📊 Known Limitations

- In-memory submissions storage (use database in production)
- No encryption at rest (database level needed)
- Relies on Gemini API security
- No request signing (add if needed)

---

## 🔍 Security Code Audit Results

**Last audit: Sept 2, 2026**
- ✅ API authentication implemented
- ✅ Rate limiting active
- ✅ Input validation enforced
- ✅ CORS hardened
- ✅ Safe JSON parsing
- ✅ No hardcoded secrets
- ✅ Error messages sanitized

---

## 📞 Security Contact

Email: **ramkisho28@gmail.com**

**Response time:** Within 48 hours
**Disclosure:** After fix is deployed (usually 30 days)

