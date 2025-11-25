# Environment Setup Instructions

## Create .env File

Create a `.env` file in the `mobile-ui/` directory with the following content:

```bash
# Backend API Configuration
VITE_API_BASE_URL=http://localhost:8000

# John Deere OAuth Callback (use localhost for local dev)
VITE_JD_CALLBACK_URL=http://localhost:5173/connections/success

# Environment
VITE_APP_ENV=development
```

## For Production Deployment

When deploying to production (e.g., Vercel), use:

```bash
VITE_API_BASE_URL=https://api.askmyfarm.us
VITE_JD_CALLBACK_URL=https://your-frontend-domain.com/connections/success
VITE_APP_ENV=production
```

## Testing with Backend

1. **Start Backend API** (from parent directory):
   ```bash
   cd ..
   source venv/bin/activate
   uvicorn app.main:app --reload
   ```

2. **Start Frontend** (from mobile-ui directory):
   ```bash
   cd mobile-ui
   npm install  # First time only
   npm run dev
   ```

3. **Access the App**:
   - Frontend: http://localhost:5173
   - Backend: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Test User Credentials

Use the test user to verify the integration:

```
Email: bobgunzy@amf-lanova.ai
Password: TestJD2024!
User ID: a551bc37-c5c0-4e38-8544-3de3c8236f2b
```

This user has already connected their John Deere account and has imported fields.

## Important Notes

- ⚠️ The `.env` file is git-ignored for security
- ⚠️ Never commit production credentials to version control
- ⚠️ Update John Deere redirect URI in JD developer portal to match `VITE_JD_CALLBACK_URL`

