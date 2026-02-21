import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const isPublicRoute = createRouteMatcher([
  "/:locale/sign-in(.*)",
  "/:locale/sign-up(.*)",
  "/:locale/sso-callback(.*)",
  "/api/webhooks(.*)",
  "/share(.*)",
  "/api/share(.*)",
  "/embed(.*)",
  "/api/embed(.*)",
  "/api/invitation-codes/verify",
]);

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  // Non-locale routes: API, embed, share — skip intl, auth only
  if (/^\/(api|embed|share)(\/|$)/.test(pathname)) {
    if (!isPublicRoute(request)) {
      await auth.protect();
    }
    return;
  }

  // Locale routes: manually check auth with locale-aware redirect
  if (!isPublicRoute(request)) {
    const { userId } = await auth();
    if (!userId) {
      const pathLocale = pathname.split("/")[1];
      const locale = (routing.locales as readonly string[]).includes(pathLocale)
        ? pathLocale
        : routing.defaultLocale;
      const signInUrl = new URL(`/${locale}/sign-in`, request.url);
      signInUrl.searchParams.set("redirect_url", request.url);
      return Response.redirect(signInUrl);
    }
  }

  return intlMiddleware(request);
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
