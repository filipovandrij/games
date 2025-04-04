import { useState } from 'react';
import SnakeGame from './SnakeGame';

const MainMenu = () => {
  const [selectedGame, setSelectedGame] = useState(null);

  const games = [
    {
      id: 'snake',
      title: 'Змейка',
      description: 'Классическая игра "Змейка". Собери как можно больше еды, не врезаясь в стены и себя!',
      component: SnakeGame
    },
    // Здесь можно добавить другие игры в будущем
  ];

  const GameComponent = selectedGame ? games.find(game => game.id === selectedGame)?.component : null;

  if (GameComponent) {
    return <GameComponent onReturnToMenu={() => setSelectedGame(null)} />;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '2rem',
      borderRadius: '15px',
      backgroundColor: 'rgba(0,0,0,0.7)',
      boxShadow: '0 0 20px rgba(0,255,0,0.1)'
    }}>
      <h1 style={{
        fontSize: '2.5rem',
        marginBottom: '1.5rem',
        color: '#fff',
        textShadow: '0 0 10px rgba(0,255,0,0.5)'
      }}>
        Игровая Площадка
      </h1>
      
      <div style={{
        display: 'grid',
        gap: '1.5rem',
        width: '100%',
        maxWidth: '400px'
      }}>
        {games.map(game => (
          <div
            key={game.id}
            onClick={() => setSelectedGame(game.id)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '10px',
              padding: '1.5rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '1px solid rgba(0,255,0,0.2)',
              ':hover': {
                transform: 'scale(1.02)',
                background: 'rgba(255,255,255,0.15)',
                borderColor: 'rgba(0,255,0,0.5)'
              }
            }}
          >
            <h2 style={{
              fontSize: '1.5rem',
              marginBottom: '0.5rem',
              color: '#00ff00'
            }}>
              {game.title}
            </h2>
            <p style={{
              color: '#aaa',
              lineHeight: '1.4'
            }}>
              {game.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MainMenu; 