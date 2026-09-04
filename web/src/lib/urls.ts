export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function guestInvitationUrl(linkToken: string): string {
  return `${getAppUrl()}/i/${linkToken}`;
}

/**
 * The owner's test invitation — the link she forwards to see what a guest gets.
 *
 * Its own segment rather than `/i/`, because it resolves a different column
 * (`Event.selfPreviewToken`, not `Invitation.linkToken`) and has no guest
 * behind it at all. Keeping the two apart is what makes it impossible for the
 * guest route to ever accidentally answer for one.
 */
export function testInvitationUrl(token: string): string {
  return `${getAppUrl()}/t/${token}`;
}
