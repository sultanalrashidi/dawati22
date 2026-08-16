import "server-only";
import { prisma } from "@/lib/db/client";
import { normalizeSaudiPhone } from "@/lib/security/phone";
import { Role } from "@/generated/prisma/client";

export class GateStaffError extends Error {}

const MAX_GATE_STAFF_PER_EVENT = 4;

export async function addGateStaffToEvent(
  eventId: string,
  ownerId: string,
  input: { phone: string; name: string }
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { gateStaffAssignments: { where: { revokedAt: null } } },
  });
  if (!event || event.ownerId !== ownerId) throw new GateStaffError("Event not found");
  if (event.gateStaffAssignments.length >= MAX_GATE_STAFF_PER_EVENT) {
    throw new GateStaffError("Maximum of 4 gate staff per event");
  }

  const phone = normalizeSaudiPhone(input.phone);
  if (!phone) throw new GateStaffError("Invalid phone number");

  let user = await prisma.user.findUnique({ where: { phone } });
  if (user && user.role !== Role.GATE_STAFF) {
    throw new GateStaffError("This phone number belongs to a different account type");
  }
  if (!user) {
    user = await prisma.user.create({ data: { phone, name: input.name, role: Role.GATE_STAFF } });
  }

  const gateStaff = await prisma.gateStaff.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, name: user.name, phone: user.phone },
  });

  const existingAssignment = await prisma.gateStaffAssignment.findUnique({
    where: { gateStaffId_eventId: { gateStaffId: gateStaff.id, eventId } },
  });
  if (existingAssignment) {
    if (existingAssignment.revokedAt) {
      return prisma.gateStaffAssignment.update({
        where: { id: existingAssignment.id },
        data: { revokedAt: null },
      });
    }
    throw new GateStaffError("Already assigned to this event");
  }

  return prisma.gateStaffAssignment.create({
    data: { gateStaffId: gateStaff.id, eventId, assignedById: ownerId },
  });
}

export async function revokeGateStaffAssignment(assignmentId: string, ownerId: string) {
  const assignment = await prisma.gateStaffAssignment.findUnique({
    where: { id: assignmentId },
    include: { event: true },
  });
  if (!assignment || assignment.event.ownerId !== ownerId) throw new GateStaffError("Assignment not found");
  await prisma.gateStaffAssignment.update({ where: { id: assignmentId }, data: { revokedAt: new Date() } });
}
