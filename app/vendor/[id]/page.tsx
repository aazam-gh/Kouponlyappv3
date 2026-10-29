export default async function VendorSharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appUrl = `kouponly:///kouponly/vendor/${encodeURIComponent(id)}`;
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
    <section style={{ maxWidth: 420, textAlign: 'center' }}>
      <h1>View this vendor on Kouponly</h1>
      <p>Open Kouponly to see this vendor’s branches and student offers.</p>
      <a href={appUrl} style={{ display: 'inline-block', padding: '16px 24px', borderRadius: 16, background: '#17683a', color: '#fff', margin: 16 }}>Open vendor in Kouponly</a>
      <p>Install Kouponly first if the app does not open.</p>
      <a href="https://play.google.com/store/apps/details?id=com.kouponly.app">Get Kouponly for Android</a>
    </section>
  </main>;
}
