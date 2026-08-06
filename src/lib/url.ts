export function appOrigin(request: Request) {
  return process.env.APP_URL ?? new URL(request.url).origin;
}
