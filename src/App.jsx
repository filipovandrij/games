import MainMenu from './components/MainMenu';

function App() {
  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
      overflow: 'hidden'
    }}>
      <MainMenu />
    </div>
  );
}

export default App;
