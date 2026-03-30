export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    "/",
    "/appointments/:path*",
    "/patients/:path*",
    "/settings/:path*",
    "/api/appointments/:path*",
    "/api/reminders/:path*",
  ],
};

