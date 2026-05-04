import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { getOrganizerAnalyticsData } from "@/src/lib/analytics/organizer";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: "#171717", fontFamily: "Helvetica" },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 6 },
  subtitle: { color: "#525252", marginBottom: 18 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginBottom: 8 },
  grid: { display: "flex", flexDirection: "row" },
  stat: { flex: 1, border: "1 solid #e5e5e5", padding: 8 },
  label: { color: "#737373", marginBottom: 4 },
  value: { fontSize: 14, fontWeight: 700 },
  table: { border: "1 solid #e5e5e5", borderBottom: 0 },
  row: { display: "flex", flexDirection: "row", borderBottom: "1 solid #e5e5e5" },
  head: { backgroundColor: "#f5f5f5", fontWeight: 700 },
  cell: { flex: 1, padding: 6 },
  cellWide: { flex: 2, padding: 6 },
  right: { textAlign: "right" },
});

function currency(value: number) {
  return `$${value.toFixed(2)}`;
}

export function ReportPdf({
  event,
  analytics,
  attendance,
}: {
  event: {
    title: string;
    startAt: Date;
    endAt: Date;
    status: string;
    venue: { name: string } | null;
  };
  analytics: Awaited<ReturnType<typeof getOrganizerAnalyticsData>>;
  attendance: {
    totalIssued: number;
    checkedIn: number;
    noShows: number;
    checkInRate: number;
  };
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.subtitle}>
          {event.status.replace("_", " ")} · {event.venue?.name ?? "Online / venue TBD"} · {event.startAt.toLocaleString()} - {event.endAt.toLocaleString()}
        </Text>

        <View style={styles.grid}>
          <View style={styles.stat}>
            <Text style={styles.label}>Gross revenue</Text>
            <Text style={styles.value}>{currency(analytics.summary.totalGross)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.label}>Net revenue</Text>
            <Text style={styles.value}>{currency(analytics.summary.totalNet)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.label}>Tickets sold</Text>
            <Text style={styles.value}>{analytics.summary.totalTicketsSold}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.label}>Paid orders</Text>
            <Text style={styles.value}>{analytics.summary.totalPaidOrders}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revenue</Text>
          <View style={styles.table}>
            <View style={[styles.row, styles.head]}>
              <Text style={styles.cellWide}>Metric</Text>
              <Text style={[styles.cell, styles.right]}>Amount</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellWide}>Gross revenue</Text>
              <Text style={[styles.cell, styles.right]}>{currency(analytics.summary.totalGross)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellWide}>Net revenue after platform fees</Text>
              <Text style={[styles.cell, styles.right]}>{currency(analytics.summary.totalNet)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ticket Type Breakdown</Text>
          <View style={styles.table}>
            <View style={[styles.row, styles.head]}>
              <Text style={styles.cellWide}>Ticket type</Text>
              <Text style={[styles.cell, styles.right]}>Sold</Text>
              <Text style={[styles.cell, styles.right]}>Revenue</Text>
            </View>
            {analytics.revenueByTicketType.length === 0 ? (
              <View style={styles.row}>
                <Text style={styles.cellWide}>No paid ticket sales yet</Text>
                <Text style={styles.cell} />
                <Text style={styles.cell} />
              </View>
            ) : (
              analytics.revenueByTicketType.map((row) => (
                <View key={row.ticketTypeName} style={styles.row}>
                  <Text style={styles.cellWide}>{row.ticketTypeName}</Text>
                  <Text style={[styles.cell, styles.right]}>{row.sold}</Text>
                  <Text style={[styles.cell, styles.right]}>{currency(row.revenue)}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendance</Text>
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={styles.cellWide}>Total tickets issued</Text>
              <Text style={[styles.cell, styles.right]}>{attendance.totalIssued}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellWide}>Checked in</Text>
              <Text style={[styles.cell, styles.right]}>{attendance.checkedIn}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellWide}>No-shows</Text>
              <Text style={[styles.cell, styles.right]}>{attendance.noShows}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cellWide}>Check-in rate</Text>
              <Text style={[styles.cell, styles.right]}>{attendance.checkInRate}%</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
