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

   • Local vs. Cloud Context: When running the app locally, the server reads the  .env  file on your hard drive. But
  when running inside Google AI Studio's cloud environment, the hosting platform does not have access to your local
  files and needs you to securely input the secrets so it can run the backend.
  ──────
  ### Option 1: Access it locally (Simplest, no inputting required)

  If you want the app to automatically read the  .env  file you configured, open your browser and navigate directly
  to:
  👉  http://localhost:3000

  #### Option 2: Provide the secrets to run it inside Google AI Studio

  If you want to run and view the app directly inside the AI Studio frame, copy and paste the values from your local
  .env  file into the corresponding fields in the UI:

  1.  GOOGLE_GENAI_USE_VERTEXAI :  true
  2.  GOOGLE_CLOUD_PROJECT :  explorer-trip-builder
  3.  GOOGLE_CLOUD_LOCATION :  us-central1
  4.  GOOGLE_APPLICATION_CREDENTIALS : Paste the entire content (the raw JSON text) of your Service Account JSON key
  file ( gcp-key.json ) here. This is required for the cloud platform to authenticate on your behalf since it cannot
  access your computer's local  gcloud  session.
  5.  VITE_GOOGLE_MAPS_API_KEY : Paste your Google Maps API key string.

3. **Authenticate via Application Default Credentials (ADC):**
   ```bash
   gcloud auth application-default login
   ```

4. **Run the app:**
   ```bash
   npm run dev
   ```

5. **Troubleshoot Google Maps API key:**
if you get an error in the frontend like "API error: 403", it means your Google Maps API key is not correctly enabled or restricted. To fix this:

Go to the Google Cloud Console.
Navigate to "APIs & Services" > "Library".
Ensure that "Maps JavaScript API" and "Directions API" are both enabled. If not, click "Enable" on each.
Go to "APIs & Services" > "Credentials".
Click on your API key to edit its restrictions.
Under "Application restrictions", ensure "HTTP referrers (web sites)" is selected and add  http://localhost:3000/*  and  https://your-custom-domain.com/* . 

6. **Troubleshoot the default credentials error:**
    The error "Could not load the default credentials" occurs because the application is trying to call Google Cloud's
  Vertex AI APIs, but your system does not have any active Google credentials configured yet (neither a local  gcloud
  CLI login, nor a referenced Service Account key).

  Since the  gcloud  CLI is not installed on your computer, you must use a Service Account JSON key file to authorize
  the app locally.

  ### How to fix it:

  1. Download your Service Account JSON Key:
      • Go to your Google Cloud Console: GCP Console Service Accounts https://console.cloud.google.com/iam-
      admin/serviceaccounts.
      • If you don't have a Service Account yet, click Create Service Account, name it, and grant it the Vertex AI
      User ( roles/aiplatform.user ) role.
      • Click on the Service Account name -> go to the Keys tab -> click Add Key -> Create new key -> select JSON ->
      click Create. A file (e.g.  your-project-xxxx.json ) will download to your computer.
  2. Save it in your project:
      • Move the downloaded JSON file into your local project directory (
      C:\Users\sedma\Documents\Coding_projects\explorer-trip-builder ).
      • Rename the file to  gcp-key.json . (I have already updated your  .gitignore  to ensure this file is never
      tracked by git or pushed to GitHub).
  3. Update your  .env  file:
      • Open your local .env file.
      • Update line 13 to point to the absolute path of your JSON key file:
        GOOGLE_APPLICATION_CREDENTIALS="C:\Users\sedma\Documents\Coding_projects\explorer-trip-builder\gcp-key.json"

  4. Restart the App:
      • Once you save the  .env  file, the local dev server will detect the change and restart. It will now
      successfully locate the credentials and process your itinerary requests without errors!

