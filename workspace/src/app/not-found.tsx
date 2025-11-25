export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '1rem'
    }}>
      <div style={{ maxWidth: '28rem' }}>
        <h1 style={{ marginTop: '2rem', fontSize: '3rem', fontWeight: 'bold' }}>404</h1>
        <h2 style={{ marginTop: '1rem', fontSize: '1.5rem', fontWeight: '600' }}>Página no encontrada</h2>
        <p style={{ marginTop: '0.5rem' }}>
          Parece que te metiste en una cancha que no existe. ¡No pasa nada, hasta a Messi le ha pasado!
        </p>
        <a href="/dashboard" style={{
          marginTop: '2rem',
          display: 'inline-block',
          padding: '0.5rem 1rem',
          textDecoration: 'none',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}>
          Volver al Vestuario
        </a>
      </div>
    </div>
  );
}
