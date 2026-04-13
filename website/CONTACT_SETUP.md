# Contact Form Setup Guide

The contact form uses [Resend](https://resend.com) to send emails when users submit the form.

## Quick Setup

### 1. Create a Resend Account

1. Go to [resend.com](https://resend.com) and sign up for a free account
2. Free tier includes 100 emails/day and 3,000 emails/month

### 2. Get Your API Key

1. In your Resend dashboard, go to **API Keys**
2. Click **Create API Key**
3. Copy the API key (it starts with `re_`)

### 3. Add Environment Variables

Add these to your `.env.local` file (local development):

```bash
RESEND_API_KEY=re_your_api_key_here
CONTACT_EMAIL=your-email@example.com
```

### 4. Configure Vercel Environment Variables

For production deployment on Vercel:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add both variables:
   - `RESEND_API_KEY` = your Resend API key
   - `CONTACT_EMAIL` = the email address where you want to receive contact form submissions
4. Make sure to add them for **Production**, **Preview**, and **Development** environments

### 5. Verify Domain (Optional but Recommended)

For production use, verify your domain in Resend:

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Follow instructions to add DNS records
4. Once verified, update the API route to use your domain:

In `src/app/api/contact/route.ts`, change:

```typescript
from: 'Baseline Contact Form <onboarding@resend.dev>',
```

to:

```typescript
from: 'Baseline Contact Form <contact@yourdomain.com>',
```

## Testing

1. Start your development server: `npm run dev`
2. Navigate to `http://localhost:3000/contact`
3. Fill out and submit the form
4. Check the email address you specified in `CONTACT_EMAIL`

## How It Works

1. User fills out the contact form at `/contact`
2. Form data is sent to `/api/contact` via POST request
3. API validates the data and sends an email using Resend
4. Email is sent to the address specified in `CONTACT_EMAIL` environment variable
5. Email includes reply-to header set to the user's email for easy responses

## Email Format

You'll receive emails with:
- **From**: Baseline Contact Form
- **Reply-To**: User's email (so you can reply directly)
- **Subject**: New Contact Form Submission from [User Name]
- **Body**: Formatted HTML with name, email, company (optional), and message

## Troubleshooting

### Email not sending?

1. Check environment variables are set correctly
2. Verify your Resend API key is valid
3. Check Resend dashboard for error logs
4. Ensure you haven't exceeded free tier limits

### Getting 500 errors?

1. Check the Vercel function logs for errors
2. Verify both `RESEND_API_KEY` and `CONTACT_EMAIL` are set in Vercel
3. Make sure environment variables are set for the correct environment

### Emails going to spam?

1. Verify your domain in Resend (see step 5 above)
2. Add SPF and DKIM records as instructed by Resend
3. This is less of an issue when using verified domains

## Cost

- **Free tier**: 100 emails/day, 3,000 emails/month
- More than enough for most contact forms
- Check [Resend pricing](https://resend.com/pricing) for paid plans if needed
