# Soccer-App

the real one

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Google sign-in

The home page introduces NextLevel. Signing in with Google opens the protected session
builder at `/session-builder`.

1. In Google Cloud Console, create an OAuth 2.0 Client ID for a **Web application**.
2. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.
3. If `.env.local` does not exist yet, copy `.env.example` to it. Otherwise, add
   `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` to the existing file without replacing
   any settings already there.
4. Set `AUTH_SECRET` to a new random secret. You can generate one with
   `openssl rand -base64 32`.
5. Keep `GOOGLE_API_KEY` set in `.env.local` if you want to use Gemini analysis,
   then restart the development server.

`GOOGLE_API_KEY` is only for Gemini analysis; it is not a Google sign-in credential.

Never commit `.env.local` or share its secrets. The session builder and its analysis
endpoint both require a signed-in Google account.

Edit the landing page in `src/app/page.tsx` or the session builder in
`src/app/session-builder/SessionBuilder.tsx`. The page auto-updates as you edit.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
