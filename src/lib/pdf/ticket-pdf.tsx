import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type TicketPdfInput = {
  eventTitle: string;
  startAt: Date;
  timezone: string;
  venueName: string | null;
  ticketTypeName: string;
  seatLabel: string | null;
  ticketNumber: string;
  qrImageSrc: string;
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    color: "#111827",
    fontFamily: "Helvetica",
    padding: 32,
  },
  brand: {
    borderBottom: "1 solid #e5e7eb",
    paddingBottom: 12,
    marginBottom: 18,
  },
  brandText: {
    color: "#4338ca",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.2,
    marginBottom: 14,
  },
  detailGrid: {
    border: "1 solid #e5e7eb",
    borderRadius: 8,
    marginBottom: 18,
  },
  detailRow: {
    borderBottom: "1 solid #f3f4f6",
    padding: 10,
  },
  detailRowLast: {
    padding: 10,
  },
  label: {
    color: "#6b7280",
    fontSize: 9,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  value: {
    color: "#111827",
    fontSize: 12,
    lineHeight: 1.4,
  },
  qrWrap: {
    alignItems: "center",
    border: "1 solid #c7d2fe",
    borderRadius: 10,
    padding: 16,
  },
  qr: {
    height: 190,
    width: 190,
  },
  ticketNumber: {
    fontFamily: "Courier",
    fontSize: 11,
    marginTop: 12,
  },
  footer: {
    color: "#6b7280",
    fontSize: 9,
    marginTop: 12,
    textAlign: "center",
  },
});

function formatTicketDate(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  }).format(value);
}

export function TicketPdf({ ticket }: { ticket: TicketPdfInput }) {
  const seatOrTableLabel = ticket.seatLabel || "General admission";

  return (
    <Document title={`Ticket ${ticket.ticketNumber}`}>
      <Page size="A6" style={styles.page}>
        <View style={styles.brand}>
          <Text style={styles.brandText}>EventsBox Ticket</Text>
        </View>

        <Text style={styles.title}>{ticket.eventTitle}</Text>

        <View style={styles.detailGrid}>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{formatTicketDate(ticket.startAt, ticket.timezone)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Venue</Text>
            <Text style={styles.value}>{ticket.venueName ?? "Venue TBA"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Ticket Type</Text>
            <Text style={styles.value}>{ticket.ticketTypeName}</Text>
          </View>
          <View style={styles.detailRowLast}>
            <Text style={styles.label}>Seat / Table</Text>
            <Text style={styles.value}>{seatOrTableLabel}</Text>
          </View>
        </View>

        <View style={styles.qrWrap}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- React PDF Image does not support alt text. */}
          <Image src={ticket.qrImageSrc} style={styles.qr} />
          <Text style={styles.ticketNumber}>{ticket.ticketNumber}</Text>
          <Text style={styles.footer}>Present this QR code at entry.</Text>
        </View>
      </Page>
    </Document>
  );
}
