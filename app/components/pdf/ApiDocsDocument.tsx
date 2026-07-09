import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#18181b',
    padding: 48,
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 24,
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
  intro: {
    marginBottom: 18,
  },
  introText: {
    fontSize: 9,
    color: '#3f3f46',
    lineHeight: 1.5,
    marginBottom: 4,
  },
  authBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 4,
    padding: 8,
    marginTop: 4,
  },
  authText: {
    fontSize: 8.5,
    fontFamily: 'Courier',
    color: '#1d4ed8',
  },
  section: {
    marginBottom: 14,
  },
  endpointHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  method: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    backgroundColor: '#2563eb',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 6,
  },
  path: {
    fontSize: 9.5,
    fontFamily: 'Courier-Bold',
    color: '#18181b',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e4e4e7',
  },
  rowLabel: {
    color: '#52525b',
    width: 90,
  },
  rowValue: {
    flex: 1,
    color: '#18181b',
    fontFamily: 'Courier',
    fontSize: 8.5,
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
  pageNumber: {
    fontSize: 8,
    color: '#a1a1aa',
  },
});

interface Endpoint {
  method: string;
  path: string;
  description: string;
  params?: string;
  body?: string;
  response: string;
}

const endpoints: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/v1/listings',
    description: 'List active listings for the tenant.',
    params: 'area, transaction_type, property_type, status (default: active), price_min, price_max',
    response: '{ listings: Listing[], count: number }',
  },
  {
    method: 'POST',
    path: '/api/v1/listings',
    description: 'Create a new listing, optionally attributed to the API key’s broker.',
    body: 'Listing fields (area, property_type, transaction_type, price_aed, dld_permit_no, ...), optional co_broker_ids[]',
    response: '{ listing: { id } } — 201 Created',
  },
  {
    method: 'GET',
    path: '/api/v1/listings/{id}',
    description: 'Retrieve a single listing by id.',
    params: 'id (path)',
    response: '{ listing: Listing }',
  },
  {
    method: 'PATCH',
    path: '/api/v1/listings/{id}',
    description: 'Update a listing’s status.',
    params: 'id (path)',
    body: '{ status: active | pending | sold | rented | expired }',
    response: '{ success: true, id, status }',
  },
  {
    method: 'GET',
    path: '/api/v1/deals',
    description: 'List closed deals for the tenant.',
    params: 'listing_id, from, to, limit (max 200)',
    response: '{ deals: Deal[], count: number }',
  },
  {
    method: 'POST',
    path: '/api/v1/deals',
    description: 'Record a closed deal and commission split.',
    body: 'listing_id, cooperating_broker_id?, listing_commission_pct, cooperating_commission_pct?, closed_at?, notes?',
    response: '{ deal: Deal } — 201 Created',
  },
  {
    method: 'GET',
    path: '/api/v1/deals/{id}',
    description: 'Retrieve a single deal by id.',
    params: 'id (path)',
    response: '{ deal: Deal }',
  },
  {
    method: 'GET',
    path: '/api/v1/brokers',
    description: 'List brokers with a signed co-brokerage agreement.',
    response: '{ brokers: Broker[], count: number }',
  },
  {
    method: 'GET',
    path: '/api/v1/commission',
    description: 'Get the tenant’s current commission split configuration.',
    response: '{ commission: { listing_pct, cooperating_pct, updated_at } }',
  },
  {
    method: 'GET',
    path: '/api/v1/trends',
    description: 'Get market trend aggregates for the tenant.',
    params: 'area, property_type, months (default: 12)',
    response: '{ trends: { avgPricePerArea[], avgPricePerSqftByType[], listingVolumeByType[], avgDaysOnMarket, dealVolumeByMonth[] } }',
  },
];

export default function ApiDocsDocument() {
  const generatedOn = new Date().toLocaleDateString('en-AE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.platformName}>Rabita</Text>
          <Text style={styles.docTitle}>API Documentation</Text>
          <Text style={styles.generatedDate}>Generated on {generatedOn}</Text>
        </View>

        <View style={styles.intro}>
          <Text style={styles.introText}>
            All endpoints are served under your tenant&apos;s base URL and require a valid API key,
            generated from the API Keys tab in the admin console.
          </Text>
          <Text style={styles.introText}>
            Every request must include the key in the Authorization header. Requests without a
            valid key return 401; revoked keys return 403. Error responses have the shape
            {' { error: string }'}.
          </Text>
          <View style={styles.authBox}>
            <Text style={styles.authText}>Authorization: Bearer &lt;your_api_key&gt;</Text>
          </View>
        </View>

        {endpoints.map((ep) => (
          <View key={`${ep.method}-${ep.path}`} style={styles.section} wrap={false}>
            <View style={styles.endpointHeader}>
              <Text style={styles.method}>{ep.method}</Text>
              <Text style={styles.path}>{ep.path}</Text>
            </View>
            <Text style={{ ...styles.introText, marginBottom: 5 }}>{ep.description}</Text>
            {ep.params && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Params</Text>
                <Text style={styles.rowValue}>{ep.params}</Text>
              </View>
            )}
            {ep.body && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Body</Text>
                <Text style={styles.rowValue}>{ep.body}</Text>
              </View>
            )}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Response</Text>
              <Text style={styles.rowValue}>{ep.response}</Text>
            </View>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated by Rabita</Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
