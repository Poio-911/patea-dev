export default function Custom500() {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '1rem',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '3rem', fontWeight: 'bold', margin: 0 }}>500</h1>
      <p style={{ color: '#666', margin: 0 }}>Error del servidor</p>
      <a
        href="/"
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#3B82F6',
          color: 'white',
          borderRadius: '0.375rem',
          textDecoration: 'none',
        }}
      >
        Volver al inicio
      </a>
    </div>
  );
}
