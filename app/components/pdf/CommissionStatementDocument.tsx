import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#18181b',
    padding: 48,
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 28,
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
    paddingBottom: 14,
  },
  platformName: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#2563eb',
    marginBottom: 4,
  },
  docTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#18181b',
    marginBottom: 2,
  },
  generatedDate: {
    fontSize: 9,
    color: '#71717a',
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#2563eb',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e4e4e7',
  },
  rowLabel: {
    color: '#52525b',
    flex: 1,
  },
  rowValue: {
    fontFamily: 'Helvetica-Bold',
    flex: 1,
    textAlign: 'right',
  },
  highlightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 4,
    marginBottom: 4,
  },
  highlightLabel: {
    color: '#1d4ed8',
    fontFamily: 'Helvetica-Bold',
    flex: 1,
  },
  highlightValue: {
    fontFamily: 'Helvetica-Bold',
    color: '#1d4ed8',
    flex: 1,
    textAlign: 'right',
  },
  dealRef: {
    fontSize: 9,
    color: '#71717a',
    fontFamily: 'Helvetica',
    marginBottom: 18,
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 48,
    right: 48,
    borderTopWidth: 0.5,
    borderTopColor: '#e4e4e7',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#a1a1aa',
  },
});

function formatAED(amount: number) {
  return `AED ${amount.toLocaleString('en-AE', { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export interface CommissionStatementData {
  dealId: string;
  closedAt: string;
  listing: {
    area: string;
    property_type: string;
    price_aed: number;
    dld_permit_no: string;
  };
  listingBroker: {
    full_name: string;
    rera_card_no: string;
    brokerage_name: string;
  };
  cooperatingBroker: {
    full_name: string;
    rera_card_no: string;
    brokerage_name: string;
  } | null;
  listingCommissionPct: number;
  cooperatingCommissionPct: number | null;
}

export default function CommissionStatementDocument({ data }: { data: CommissionStatementData }) {
  const totalCommissionAed = data.listing.price_aed * 0.02;
  const listingShareAed = totalCommissionAed * (data.listingCommissionPct / 100);
  const coopShareAed = data.cooperatingCommissionPct != null
    ? totalCommissionAed * (data.cooperatingCommissionPct / 100)
    : 0;

  const generatedOn = new Date().toLocaleDateString('en-AE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.platformName}>Micro MLS</Text>
          <Text style={styles.docTitle}>Commission Statement</Text>
          <Text style={styles.generatedDate}>Generated on {generatedOn}</Text>
        </View>

        {/* Deal reference */}
        <Text style={styles.dealRef}>Deal Reference: {data.dealId}</Text>

        {/* Property Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Property Details</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Location</Text>
            <Text style={styles.rowValue}>{data.listing.area}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Property Type</Text>
            <Text style={styles.rowValue}>{data.listing.property_type.charAt(0).toUpperCase() + data.listing.property_type.slice(1)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Sale Price</Text>
            <Text style={styles.rowValue}>{formatAED(data.listing.price_aed)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>DLD Permit No.</Text>
            <Text style={styles.rowValue}>{data.listing.dld_permit_no}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Closed Date</Text>
            <Text style={styles.rowValue}>{formatDate(data.closedAt)}</Text>
          </View>
        </View>

        {/* Broker Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Broker Details</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Listing Broker</Text>
            <Text style={styles.rowValue}>{data.listingBroker.full_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Listing RERA Card</Text>
            <Text style={styles.rowValue}>{data.listingBroker.rera_card_no}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Listing Brokerage</Text>
            <Text style={styles.rowValue}>{data.listingBroker.brokerage_name}</Text>
          </View>
          {data.cooperatingBroker ? (
            <>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Cooperating Broker</Text>
                <Text style={styles.rowValue}>{data.cooperatingBroker.full_name}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Cooperating RERA Card</Text>
                <Text style={styles.rowValue}>{data.cooperatingBroker.rera_card_no}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Cooperating Brokerage</Text>
                <Text style={styles.rowValue}>{data.cooperatingBroker.brokerage_name}</Text>
              </View>
            </>
          ) : (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Cooperating Broker</Text>
              <Text style={styles.rowValue}>Self-deal (none)</Text>
            </View>
          )}
        </View>

        {/* Commission Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Commission Breakdown</Text>
          <View style={styles.highlightRow}>
            <Text style={styles.highlightLabel}>Total Commission (2%)</Text>
            <Text style={styles.highlightValue}>{formatAED(totalCommissionAed)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Listing Broker Share ({data.listingCommissionPct}%)</Text>
            <Text style={styles.rowValue}>{formatAED(listingShareAed)}</Text>
          </View>
          {data.cooperatingBroker && data.cooperatingCommissionPct != null ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Cooperating Broker Share ({data.cooperatingCommissionPct}%)</Text>
              <Text style={styles.rowValue}>{formatAED(coopShareAed)}</Text>
            </View>
          ) : null}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated by Micro MLS</Text>
          <Text style={styles.footerText}>This document is for informational purposes only.</Text>
        </View>
      </Page>
    </Document>
  );
}
