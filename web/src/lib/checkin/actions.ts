"use server";

import { requireUserOrThrow } from "@/lib/auth/guards";
import { assertGateAccess, performCheckIn, type CheckInOutcome } from "@/lib/checkin/service";
import { Role } from "@/generated/prisma/client";

export async function scanQrAction(eventId: string, qrToken: string): Promise<CheckInOutcome> {
  const user = await requireUserOrThrow([Role.GATE_STAFF, Role.ADMIN]);
  const gateStaffId = await assertGateAccess(user.id, user.role, eventId);
  return performCheckIn(qrToken.trim(), eventId, gateStaffId);
}
