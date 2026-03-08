import { expect, test } from "@playwright/test";

test("attendee can complete mocked checkout and land on order confirmation", async ({ page }) => {
  const orderId = "ord_e2e_mock";

  await page.route("**/api/public/events/mock-concert", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          id: "evt_mock",
          title: "Mock Concert",
          slug: "mock-concert",
          heroImage: null,
          description: "Mocked event for checkout flow",
          startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          timezone: "Asia/Dhaka",
          contactEmail: "support@mock.local",
          contactPhone: null,
          cancelPolicy: null,
          refundPolicy: null,
          gstPct: 15,
          commissionPct: 10,
          platformFeeFixed: 0,
          category: { name: "Music" },
          venue: { name: "Mock Arena", addressLine1: "Mock Street 1" },
          state: { name: "Dhaka" },
          city: { name: "Dhaka" },
          organizerProfile: { companyName: "Mock Org", brandName: "Mock Org", website: null, supportEmail: null },
          ticketTypes: [
            {
              id: "tt_mock",
              name: "General Admission",
              description: null,
              kind: "DIRECT",
              price: 50,
              quantity: 100,
              sold: 0,
              maxPerOrder: 10,
              saleStartAt: null,
              saleEndAt: null,
            },
          ],
        },
      }),
    });
  });

  await page.route("**/api/checkout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          orderId,
          clientSecret: "cs_mock_123",
          summary: { subtotal: 50, platformFee: 5, gst: 8.25, total: 63.25 },
        },
      }),
    });
  });

  await page.route(`**/api/orders/${orderId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          id: orderId,
          buyerName: "Mock Buyer",
          buyerEmail: "buyer@mock.local",
          status: "PAID",
          subtotal: 50,
          platformFee: 5,
          gst: 8.25,
          total: 63.25,
          paidAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          event: {
            id: "evt_mock",
            title: "Mock Concert",
            slug: "mock-concert",
            startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
            timezone: "Asia/Dhaka",
            venue: { name: "Mock Arena", addressLine1: "Mock Street 1" },
          },
          items: [
            {
              id: "item_mock",
              quantity: 1,
              unitPrice: 50,
              subtotal: 50,
              ticketType: { id: "tt_mock", name: "General Admission", kind: "DIRECT" },
              tickets: [
                {
                  id: "qr_mock",
                  token: "token_mock",
                  ticketNumber: "MOCK-0001",
                  checkedInAt: null,
                },
              ],
            },
          ],
        },
      }),
    });
  });

  await page.goto("/events/mock-concert");
  await expect(page.getByRole("heading", { name: "Mock Concert" })).toBeVisible();

  await page.locator("button", { hasText: "+" }).first().click();
  await page.getByPlaceholder("Jane Smith").fill("Mock Buyer");
  await page.getByPlaceholder("jane@example.com").fill("buyer@mock.local");
  await page.getByRole("button", { name: "Pay $63.25" }).click();

  await page.waitForURL(new RegExp(`.*/(checkout|orders)/${orderId}.*`));
  await page.waitForURL(new RegExp(`.*/orders/${orderId}.*`));
  await expect(page.getByText("Booking Confirmed!")).toBeVisible();
});
