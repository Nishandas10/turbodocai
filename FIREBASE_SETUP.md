# Firebase Authentication Setup

This project uses Firebase for authentication. Follow these steps to set up Firebase:

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or select an existing project
3. Follow the setup wizard

## 2. Enable Authentication

1. In your Firebase project, go to "Authentication" in the left sidebar
2. Click "Get started"
3. Go to the "Sign-in method" tab
4. Enable the following providers:
   - **Google** (for Google sign-in)
   - **Email link (passwordless sign-in)** (for email no-password sign-in)

### Google Sign-in Setup
1. Click on "Google" provider
2. Enable it and add your authorized domain
3. Save the changes

### Email Link Setup
1. Click on "Email link (passwordless sign-in)"
2. Enable it
3. Add your authorized domain
4. Save the changes

## 3. Get Firebase Configuration

1. In your Firebase project, click the gear icon (⚙️) next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click the web app icon (</>)
5. Register your app with a nickname
6. Copy the Firebase configuration object

## 4. Environment Variables

Create a `.env.local` file in your project root with the following variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

Replace the values with your actual Firebase configuration.

## 5. Test the Setup

1. Start your development server: `npm run dev`
2. Go to `/signup` page
3. Try signing in with Google
4. Try signing in with email (you'll receive a sign-in link)

## Features

- **Google Sign-in**: Users can sign in with their Google account
- **Email No-Password**: Users receive a sign-in link via email
- **Protected Routes**: Dashboard is only accessible to authenticated users
- **Automatic Redirects**: Users are redirected to dashboard after successful authentication
- **Sign-out**: Users can sign out and are redirected to signup page

## Troubleshooting

- Make sure all environment variables are set correctly
- Check that Google and Email link providers are enabled in Firebase
- Verify your domain is authorized in Firebase Authentication settings
- Check browser console for any error messages 