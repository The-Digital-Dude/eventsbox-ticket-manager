import { z } from "zod";

export const accountTicketQrParamsSchema = z.object({
  ticketId: z.string().min(1),
});
