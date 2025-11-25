# AskMyFarm - Mobile UI

Modern mobile-first Progressive Web App (PWA) for voice-powered farm management and field planning.

**🌐 Live App:** [askmyfarm.us](https://askmyfarm.us)

[![Deployment](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat&logo=vercel)](https://vercel.com)
[![Domain](https://img.shields.io/badge/Domain-askmyfarm.us-green?style=flat)](https://askmyfarm.us)

## 🌾 About

AskMyFarm transforms voice notes into actionable farm intelligence. This mobile-optimized web application provides farmers with a powerful, intuitive interface for:

- **🧠 Farm Memory**: AI-powered semantic search across all your farm data (voice notes, documents, photos, field plans)
- **🔍 Intelligent Search**: Search your entire farm history with natural language and get AI-synthesized answers
- **🎤 Voice Intelligence**: Record and process voice notes with AI-powered transcription and automatic field matching
- **📄 Smart Document Processing**: Upload and automatically extract insights from documents and photos
- **📋 Field Planning**: Create and manage comprehensive field plans with multi-pass operations
- **🗺️ Prescription Generation**: Generate variable-rate or flat-rate prescriptions with management zone integration
- **🚜 John Deere Integration**: Seamless sync with JD Operations Center for fields and prescription upload
- **🛰️ Field Monitoring**: Real-time NDVI satellite imagery and precipitation tracking
- **📊 Management Zones**: Variable-rate prescription generation using multi-year NDVI data
- **📱 Offline Support**: PWA capabilities for offline access and background sync

## 🚀 Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **UI Library**: shadcn/ui (Radix UI + Tailwind CSS)
- **Routing**: React Router v6
- **State Management**: React Query (TanStack Query)
- **Maps**: Leaflet + React Leaflet
- **Forms**: React Hook Form + Zod validation
- **Styling**: Tailwind CSS + tailwindcss-animate
- **PWA**: Vite PWA Plugin with Workbox
- **HTTP Client**: Fetch API with custom wrapper

### AI & Intelligence
- **Semantic Search**: Vector embeddings for natural language search
- **AI Ranking**: Advanced result re-ranking with relevance scoring
- **Voice Transcription**: Speech-to-Text with automatic field matching
- **Document Processing**: Intelligent content extraction and indexing
- **Synthesized Answers**: AI-generated summaries from multiple sources

## 📋 Prerequisites

- Node.js 18+ (recommended: use [nvm](https://github.com/nvm-sh/nvm))
- npm or yarn
- Backend API running (see main project README)

## 🛠️ Installation & Setup

### 1. Clone and Install

```bash
cd mobile-ui
npm install
```

### 2. Environment Configuration

Create a `.env` file in the project root directory:

```bash
# Backend API Configuration (Required)
VITE_API_BASE_URL=http://localhost:8000

# Environment (Optional)
VITE_APP_ENV=development
```

> **Note:** The `.env` file is gitignored for security. Never commit API keys or secrets to version control.

**Environment Variables:**

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | ✅ Yes | `http://localhost:8000` |
| `VITE_APP_ENV` | Environment name | ❌ No | `development` |

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:8080`

## 📦 Building for Production

```bash
# Production build
npm run build

# Preview production build locally
npm run preview
```

The build output will be in the `dist/` directory.

## 🌐 Deployment

### Vercel Deployment (Recommended)

1. **Push to GitHub** (if not already)
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will auto-detect Vite configuration

3. **Set Environment Variables** in Vercel Dashboard
   - Project Settings → Environment Variables
   - Add: `VITE_API_BASE_URL` = `https://your-backend-api.com`
   - Add: `VITE_APP_ENV` = `production`

4. **Configure Custom Domain** (Optional)
   - Project Settings → Domains
   - Add your domain (e.g., `askmyfarm.us`)
   - Update DNS records at your registrar
   - Wait for DNS propagation and SSL provisioning

5. **Deploy**
   - Vercel will automatically build and deploy
   - Every push to main will trigger auto-deployment

### Manual Deployment

```bash
# Build for production
npm run build

# Upload dist/ folder to your hosting service
```

## 🎯 Key Features

### 🧠 Farm Memory - AI-Powered Search
**Your farm's digital memory that learns and remembers everything.**

- **Semantic Search**: Search using natural language across all your farm data
- **AI-Synthesized Answers**: Advanced search provides intelligent summaries from multiple sources
- **Cross-Content Search**: Find information across voice notes, documents, photos, and field plans
- **Smart Ranking**: AI re-ranks results by relevance with explanations
- **Similarity Scoring**: See how closely each result matches your query
- **Suggested Searches**: Quick access to common queries
- **Source Navigation**: Click any result to jump directly to the original content

**Search Examples:**
- "rust disease treatments"
- "soil test results from last spring"
- "fungicide applications for North Field"
- "planting dates for corn"

### 🎤 Voice Intelligence
- Record voice notes on-the-go with mobile-optimized interface
- AI-powered transcription (Speech-to-Text) with high accuracy
- Automatic field matching with confidence scoring
- Extract field plans, tasks, and observations from voice
- Offline recording with automatic upload when online
- Voice notes automatically indexed for Farm Memory search

### 📋 Field Planning
- Create comprehensive field plans for each field
- Multi-pass operations (tillage, planting, fertilizer, spraying, etc.)
- Product management with cost tracking
- Status tracking (Draft → Active → Completed)
- Document attachments per plan/pass

### 🗺️ Prescription Generation (NEW!)
**Two-Step Review Workflow:**
1. **Generate & Preview**: Create prescription with map preview
2. **Review & Upload**: Review prescription map, then upload to John Deere

**Features:**
- Flat-rate or variable-rate (zone-based) prescriptions
- Management zone integration (7-year NDVI data)
- Custom zone rates or auto-calculation (±10%)
- Preview map before uploading
- Direct upload to John Deere Operations Center
- Download option for manual upload

### 🚜 John Deere Integration
- OAuth 2.0 authentication
- Import fields with boundaries
- Upload prescriptions directly to JD Files
- Sync field data

### 🛰️ Field Monitoring
- Real-time NDVI satellite imagery layers
- 7-day precipitation accumulation (RTMA)
- Multi-year management zones visualization
- Interactive map with field boundaries

### 📸 Field Notes & Photo Capture
- Create field observations with photos
- Mobile-optimized camera access (Android, iOS)
- Direct camera capture or gallery selection
- Multiple photo attachments per field note
- HTTPS-secured camera permissions
- Smart error handling for camera access

### 📄 Intelligent Document & Photo Processing
- **Smart Upload**: Documents and photos automatically processed and indexed
- **Content Extraction**: AI extracts key information from uploaded documents
- **Searchable Content**: All documents become searchable through Farm Memory
- **Multiple Formats**: Support for PDFs, images (JPEG, PNG, WebP), and documents
- **Automatic Categorization**: Documents linked to fields, plans, and observations
- **Field Association**: Attach documents to specific fields or field notes
- **Date Tracking**: Automatic timestamp and location metadata
- **AI-Enhanced Search**: Find documents by content, not just filename

### 📱 Progressive Web App (PWA)
- Install as mobile app (Add to Home Screen)
- Offline support with service worker
- Background sync for queued operations
- Optimized for mobile devices
- Native camera access for field photos
- Cross-platform photo upload (Android, iOS, Desktop)

## 📁 Project Structure

```
mobile-ui/
├── docs/              # Documentation
│   └── BRAND_STYLE_GUIDE.md  # Brand colors, typography, components
├── public/              # Static assets
│   ├── icons/          # PWA icons (PNG + SVG)
│   └── offline.html    # Offline fallback page
├── src/
│   ├── components/     # Reusable UI components
│   │   ├── PhotoUploadModal.tsx  # Enhanced camera/photo upload
│   │   └── ui/        # shadcn/ui components
│   ├── config/        # Configuration files
│   │   └── env.ts     # Environment config
│   ├── contexts/      # React contexts (Auth, etc.)
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utilities
│   │   ├── api.ts    # API client with auth
│   │   └── utils.ts  # Helper functions
│   ├── pages/         # Route components
│   │   ├── Welcome.tsx      # Landing page
│   │   ├── Home.tsx         # Dashboard with Farm Memory search
│   │   ├── FarmMemory.tsx   # AI-powered search page
│   │   ├── VoiceCapture.tsx # Voice recording & transcription
│   │   ├── FieldNoteForm.tsx # Field notes with photos
│   │   └── ...
│   ├── services/      # Service workers, offline queue
│   └── main.tsx       # Application entry point
├── .env               # Environment variables (gitignored)
├── .gitignore         # Git ignore rules
├── vite.config.ts     # Vite & PWA configuration
└── package.json       # Dependencies
```

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start dev server (port 8080)
npm run build        # Production build
npm run build:dev    # Development build
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### API Client

The app uses a custom API client (`src/lib/api.ts`) with:
- Automatic JWT token management
- Token refresh on 401 errors
- Centralized error handling
- TypeScript types for all endpoints

**Example Usage:**
```typescript
import { fieldPlansAPI } from '@/lib/api';

// Get all field plans
const plans = await fieldPlansAPI.getFieldPlans();

// Generate prescription
const result = await fieldPlansAPI.generatePrescription(passId, {
  use_zones: true,
  zone_source: 'sentinel2_ndvi_7yr',
  push_to_jd: false  // Generate locally, upload later
});

// Upload to John Deere
const uploaded = await fieldPlansAPI.uploadPrescriptionToJD(prescriptionId);
```

## 🎨 UI Components & Design System

Built with [shadcn/ui](https://ui.shadcn.com/) - a collection of beautiful, accessible components:
- Buttons, Cards, Dialogs, Dropdowns
- Forms, Inputs, Selects, Switches
- Toasts (Sonner), Progress, Badges
- All fully customizable with Tailwind CSS

**📘 Brand Style Guide:** See [`docs/BRAND_STYLE_GUIDE.md`](docs/BRAND_STYLE_GUIDE.md) for:
- Complete color palette (Farm Green primary, dark theme)
- Typography system and type scale
- Component styles and patterns
- Icon guidelines
- Logo usage and brand name treatment
- Code examples and usage patterns

## 🔐 Authentication

- Magic link authentication via SMS/Email
- JWT token management with auto-refresh
- Protected routes with `ProtectedRoute` component
- Session persistence in localStorage

## 📱 PWA Configuration

- **Manifest**: `vite.config.ts` - PWA manifest configuration
- **Service Worker**: Auto-generated by `vite-plugin-pwa`
- **Caching Strategy**: 
  - API calls: NetworkFirst
  - Images: CacheFirst
  - Static assets: Precached

## 🐛 Troubleshooting

### API Connection Issues
- Verify `VITE_API_BASE_URL` is set correctly in Vercel environment variables
- Check backend is running and accessible
- Check browser console for CORS errors
- **Production:** Ensure backend CORS allows `https://askmyfarm.us` and `https://www.askmyfarm.us`

### Build Fails
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### PWA Not Working
- PWA only works in production builds (`npm run build`)
- HTTPS required for production (Vercel provides this)
- Check service worker registration in DevTools

### Camera Access Issues (Mobile)
- **Camera not opening**: Ensure HTTPS is enabled (required for camera access)
- **Permission denied**: Check browser settings → Site permissions → Camera
- **Android shows chooser**: This is normal behavior; Android may show Camera + Gallery options
- **iOS action sheet**: iOS shows Camera / Photo Library / Browse - all options work
- **Desktop**: Camera not available; use "Choose Photos" to upload files
- **Workaround**: If camera fails, use "Choose Photos" button as fallback

## 📝 Recent Updates

### Production Deployment (Latest)
- ✅ **Live at:** [askmyfarm.us](https://askmyfarm.us)
- ✅ Custom domain configured with SSL
- ✅ Deployed on Vercel with auto-deployment from GitHub
- ✅ DNS configured with GoDaddy
- ✅ HTTPS enabled for secure camera access

### Farm Memory - AI-Powered Intelligence (Featured)
- ✅ **Semantic Search**: Natural language search across all farm data
- ✅ **AI Ranking**: Intelligent result re-ranking with relevance explanations
- ✅ **Synthesized Answers**: AI-generated summaries from multiple sources
- ✅ **Cross-Content Search**: Search voice notes, documents, photos, and field plans
- ✅ **Advanced Search Toggle**: Basic or AI-powered search modes
- ✅ **Similarity Scoring**: Percentage match display for each result
- ✅ **Smart Suggestions**: Context-aware suggested searches

### Mobile Camera & Photo Upload
- ✅ Enhanced camera access for Android and iOS devices
- ✅ Dual input options: Direct camera or gallery selection
- ✅ Smart error handling with user-friendly messages
- ✅ HTTPS security validation for camera permissions
- ✅ Support for JPEG, PNG, and WebP formats
- ✅ File size validation (max 10MB per image)
- ✅ Cross-platform compatibility (handles OS differences)
- ✅ Intelligent document and photo indexing for search

### Prescription Generation Workflow
- ✅ Two-step review process (Generate → Preview → Upload)
- ✅ Separate "Upload to John Deere" action
- ✅ Preview prescription map before committing
- ✅ New backend endpoint: `POST /prescriptions/{id}/upload-to-jd`
- ✅ Improved UX with clear status indicators
- ✅ Zone-based variable-rate prescriptions with NDVI data

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

Proprietary - AskMyFarm Platform

## 🆘 Support

For issues or questions:
- Check backend API documentation
- Review API logs for error details
- Ensure all environment variables are configured

---

## 🚀 Production Information

**Live Application:** [https://askmyfarm.us](https://askmyfarm.us)

**Infrastructure:**
- **Hosting:** Vercel (automatic deployments from GitHub)
- **Domain:** askmyfarm.us (GoDaddy DNS)
- **SSL:** Auto-provisioned by Vercel (Let's Encrypt)
- **CDN:** Global edge network via Vercel
- **Backend API:** CORS configured for production domain

**Requirements for Features:**
- **Camera Access:** Requires HTTPS (✅ enabled)
- **PWA Install:** Available on mobile devices
- **Offline Support:** Service worker enabled
- **AI Search:** Farm Memory with semantic search and AI ranking
- **Voice Transcription:** Automatic Speech-to-Text processing
- **Document Intelligence:** Automatic content extraction and indexing

---

**Built with ❤️ for modern agriculture**
