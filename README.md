<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Explorer. Trip Builder

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/3b53ff42-ab39-4b31-8a5b-51bc1f7352d0

## Run Locally

**Prerequisites:** Node.js, Google Cloud SDK (`gcloud`)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.example` to `.env`.
   - Set `GOOGLE_CLOUD_PROJECT` to your Google Cloud project ID.
   - Set `VITE_GOOGLE_MAPS_API_KEY` to your Google Maps API key.

3. **Authenticate via Application Default Credentials (ADC):**
   ```bash
   gcloud auth application-default login
   ```

4. **Run the app:**
   ```bash
   npm run dev
   ```
