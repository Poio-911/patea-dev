import { NextPageContext } from 'next';

interface ErrorProps {
  statusCode?: number;
}

function Error({ statusCode }: ErrorProps) {
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
      <h1 style={{ fontSize: '3rem', fontWeight: 'bold', margin: 0 }}>
        {statusCode || 'Error'}
      </h1>
      <p style={{ color: '#666', margin: 0 }}>
        {statusCode === 404
          ? 'Esta pagina no existe'
          : 'Ocurrio un error'}
      </p>
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

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
