import { NextRequest } from "next/server";
import { PATCH as patchTicketType } from "../../tickets/[ticketId]/route";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; ticketTypeId: string }> },
) {
  const { id, ticketTypeId } = await params;
  return patchTicketType(req, { params: Promise.resolve({ id, ticketId: ticketTypeId }) });
}
