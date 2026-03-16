import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { eventCountMock, eventFindManyMock, orderCountMock } = vi.hoisted(() => ({
  eventCountMock: vi.fn(),
  eventFindManyMock: vi.fn(),
  orderCountMock: vi.fn(),
}));

vi.mock("@/src/lib/db", () => ({
  prisma: {
    event: {
      count: eventCountMock,
      findMany: eventFindManyMock,
    },
    order: {
      count: orderCountMock,
    },
  },
}));

import HomePage from "@/app/page";

describe("home page integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the homepage shell when the database is unavailable", async () => {
    const dbError = new Error("Can't reach database server at `example-db:5432`");
    dbError.name = "PrismaClientInitializationError";

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    eventCountMock.mockRejectedValueOnce(dbError);
    orderCountMock.mockResolvedValueOnce(12);
    eventFindManyMock.mockResolvedValueOnce([]);

    const markup = renderToStaticMarkup(await HomePage());

    expect(markup).toContain("EventsBox");
    expect(markup).toContain("Live Events");
    expect(markup).toContain("Tickets Sold");
    expect(markup).toContain(">0+</p>");
    expect(markup).not.toContain("Upcoming Events");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[app/page.tsx][getStats] Homepage stats unavailable because the database could not be reached.",
      dbError,
    );

    consoleErrorSpy.mockRestore();
  });
});
