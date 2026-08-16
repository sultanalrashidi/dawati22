export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function guestInvitationUrl(linkToken: string): string {
  return `${getAppUrl()}/i/${linkToken}`;
}
