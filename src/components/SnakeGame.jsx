import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';

const GRID_SIZE = 20; // Размер одной клетки
const GRID_WIDTH = 30; // Количество клеток по ширине
const GRID_HEIGHT = 20; // Количество клеток по высоте

// Пресеты сложности
const DIFFICULTY_PRESETS = {
  EASY: {
    GAME_SPEED: 600,
    MOVEMENT_SMOOTHNESS: 0.15,
    TURN_SMOOTHNESS: 0.25,
    TAIL_SMOOTHNESS: 0.2,
    label: 'Easy'
  },
  MEDIUM: {
    GAME_SPEED: 300,
    MOVEMENT_SMOOTHNESS: 0.2,
    TURN_SMOOTHNESS: 0.3,
    TAIL_SMOOTHNESS: 0.25,
    label: 'Medium'
  },
  HARD: {
    GAME_SPEED: 200,
    MOVEMENT_SMOOTHNESS: 0.25,
    TURN_SMOOTHNESS: 0.35,
    TAIL_SMOOTHNESS: 0.3,
    label: 'Hard'
  },
  EXPERT: {
    GAME_SPEED: 100,
    MOVEMENT_SMOOTHNESS: 0.3,
    TURN_SMOOTHNESS: 0.4,
    TAIL_SMOOTHNESS: 0.35,
    label: 'Expert'
  }
};

// Текущие настройки скорости (будут установлены после выбора сложности)
let currentSpeed = null;
const GROWTH_ANIMATION_DURATION = 500; // Длительность анимации роста (мс)
const TAIL_SMOOTHNESS = 0.35; // Добавляем отдельный коэффициент для хвоста
const INPUT_BUFFER_TIME = 16; // Уменьшаем время буфера до одного кадра (60 FPS)
const ANIMATION_FPS = 60; // Добавляем константу для частоты обновления анимации
const TURN_WINDOW = 150; // Окно времени для выполнения поворота на 180 градусов

const SnakeGame = ({ onReturnToMenu }) => {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const isInitializedRef = useRef(false);
  const cleanupRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [difficulty, setDifficulty] = useState(null);

  // Состояние змейки и еды
  const snakeRef = useRef({
    body: [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 }
    ],
    direction: 'right',
    nextDirection: 'right',
  });
  const foodRef = useRef({ x: 15, y: 10 });

  // Спрайты
  const snakeContainerRef = useRef(null);
  const foodSpriteRef = useRef(null);
  const growthAnimationRef = useRef(null);

  // Добавляем ref для хранения текущих позиций для анимации
  const currentPositionsRef = useRef([]);

  // Добавляем буфер для команд
  const inputBufferRef = useRef([]);
  const lastInputTimeRef = useRef(0);

  // Добавляем состояние для последней корректной команды
  const lastValidCommandRef = useRef(null);

  // Генерация новой еды
  const generateFood = () => {
    const x = Math.floor(Math.random() * GRID_WIDTH);
    const y = Math.floor(Math.random() * GRID_HEIGHT);
    
    // Проверяем, не попала ли еда на змейку
    const isOnSnake = snakeRef.current.body.some(segment => 
      segment.x === x && segment.y === y
    );
    
    if (isOnSnake) {
      return generateFood();
    }
    
    return { x, y };
  };

  // Обработка нажатий клавиш
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameOver) return;

      const currentTime = Date.now();
      const snake = snakeRef.current;
      let newDirection = '';

      // Определяем новое направление
      switch (e.key) {
        case 'ArrowUp':
          newDirection = 'up';
          break;
        case 'ArrowDown':
          newDirection = 'down';
          break;
        case 'ArrowLeft':
          newDirection = 'left';
          break;
        case 'ArrowRight':
          newDirection = 'right';
          break;
        default:
          return;
      }

      // Проверяем возможность поворота на 180 градусов
      const lastCommand = lastValidCommandRef.current;
      const timeSinceLastCommand = currentTime - (lastCommand?.timestamp || 0);
      
      // Если это быстрое нажатие в противоположном направлении
      if (lastCommand && timeSinceLastCommand < TURN_WINDOW) {
        const opposites = {
          'up': 'down',
          'down': 'up',
          'left': 'right',
          'right': 'left'
        };
        
        // Если игрок быстро нажал противоположное направление
        if (opposites[lastCommand.direction] === newDirection) {
          // Добавляем промежуточный поворот
          const intermediateDirection = snake.direction === 'up' || snake.direction === 'down' ? 'left' : 'up';
          
          inputBufferRef.current = [
            { direction: intermediateDirection, timestamp: currentTime },
            { direction: newDirection, timestamp: currentTime + 1 }
          ];
          
          lastValidCommandRef.current = {
            direction: newDirection,
            timestamp: currentTime
          };
          return;
        }
      }

      // Обычная обработка команды
      if (newDirection) {
        inputBufferRef.current.push({
          direction: newDirection,
          timestamp: currentTime
        });

        // Ограничиваем размер буфера до 2 команд
        if (inputBufferRef.current.length > 2) {
          inputBufferRef.current.shift();
        }

        lastValidCommandRef.current = {
          direction: newDirection,
          timestamp: currentTime
        };
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameOver]);

  // Изменяем функцию проверки валидности смены направления
  const isValidDirectionChange = (prevDirection, newDirection) => {
    const opposites = {
      'up': 'down',
      'down': 'up',
      'left': 'right',
      'right': 'left'
    };

    // Разрешаем любой поворот, если это промежуточное направление
    if (inputBufferRef.current.length === 2) {
      return true;
    }

    // Нельзя двигаться в противоположном направлении напрямую
    return opposites[prevDirection] !== newDirection;
  };

  // Основной игровой цикл
  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current || !gameStarted) return;

    const app = new PIXI.Application();
    appRef.current = app;

    app.init({
      width: GRID_WIDTH * GRID_SIZE,
      height: GRID_HEIGHT * GRID_SIZE,
      backgroundColor: 0x1a1a1a, // Темный фон
      antialias: true,
      resolution: window.devicePixelRatio || 1,
    }).then(() => {
      if (!containerRef.current) return;
      
      isInitializedRef.current = true;
      
      // Очищаем контейнер
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }
      
      // Добавляем canvas
      if (app.canvas && containerRef.current) {
        containerRef.current.appendChild(app.canvas);
      }

      // Добавляем сетку на фон
      const grid = new PIXI.Graphics();
      grid.lineStyle(1, 0x333333, 0.3);
      
      // Вертикальные линии
      for (let x = 0; x <= GRID_WIDTH; x++) {
        grid.moveTo(x * GRID_SIZE, 0);
        grid.lineTo(x * GRID_SIZE, GRID_HEIGHT * GRID_SIZE);
      }
      
      // Горизонтальные линии
      for (let y = 0; y <= GRID_HEIGHT; y++) {
        grid.moveTo(0, y * GRID_SIZE);
        grid.lineTo(GRID_WIDTH * GRID_SIZE, y * GRID_SIZE);
      }
      
      app.stage.addChild(grid);

      // Добавляем границы поля
      const border = new PIXI.Graphics();
      border.lineStyle(2, 0x00FF00, 0.5); // Зеленая рамка
      border.drawRect(0, 0, GRID_WIDTH * GRID_SIZE, GRID_HEIGHT * GRID_SIZE);
      
      // Добавляем свечение для границ
      const borderGlow = new PIXI.Graphics();
      borderGlow.lineStyle(4, 0x00FF00, 0.2);
      borderGlow.drawRect(-2, -2, GRID_WIDTH * GRID_SIZE + 4, GRID_HEIGHT * GRID_SIZE + 4);
      borderGlow.filters = [new PIXI.BlurFilter(2)];
      
      app.stage.addChild(borderGlow);
      app.stage.addChild(border);

      // Создаем контейнер для змейки
      const snakeContainer = new PIXI.Container();
      app.stage.addChild(snakeContainer);
      snakeContainerRef.current = snakeContainer;

      // Инициализируем текущие позиции
      currentPositionsRef.current = snakeRef.current.body.map(segment => ({
        x: segment.x * GRID_SIZE,
        y: segment.y * GRID_SIZE
      }));

      // Создаем спрайт для еды
      const food = new PIXI.Graphics();
      const foodPadding = 2;
      const foodSize = GRID_SIZE - (foodPadding * 2);
      
      // Делаем еду более привлекательной
      food.circle(GRID_SIZE / 2, GRID_SIZE / 2, foodSize / 2);
      food.fill({ color: 0xFF0000 });
      
      // Добавляем внутренний блик для еды
      food.circle(GRID_SIZE / 2 - 2, GRID_SIZE / 2 - 2, foodSize / 4);
      food.fill({ 
        color: 0xFF6666,
        alpha: 0.5 
      });
      
      // Улучшаем свечение для еды
      food.filters = [new PIXI.BlurFilter({
        strength: 2,
        quality: 6,
        resolution: window.devicePixelRatio || 1
      })];
      
      food.x = foodRef.current.x * GRID_SIZE;
      food.y = foodRef.current.y * GRID_SIZE;
      app.stage.addChild(food);
      foodSpriteRef.current = food;

      const drawSnake = () => {
        const container = snakeContainerRef.current;
        if (!container) return;

        // Очищаем контейнер
        container.removeChildren();
        
        // Отрисовываем каждый сегмент змейки
        snakeRef.current.body.forEach((segment, index) => {
          const graphics = new PIXI.Graphics();
          const padding = 1;
          const segmentSize = GRID_SIZE - (padding * 2);
          const radius = 4;
          
          graphics.clear();

          if (index === 0) {
            // Голова змеи - делаем более округлой
            const headRadius = 8; // Увеличиваем радиус закругления для головы
            
            // Основная форма головы
            graphics.rect(padding, padding, segmentSize, segmentSize, headRadius);
            graphics.fill({ 
              color: 0x00FF00,
              alpha: 1
            });

            // Добавляем дополнительное закругление спереди по направлению движения
            const noseSize = 6;
            let noseX = padding + segmentSize / 2;
            let noseY = padding + segmentSize / 2;
            
            switch (snakeRef.current.direction) {
              case 'right':
                graphics.circle(padding + segmentSize - noseSize/2, noseY, noseSize);
                break;
              case 'left':
                graphics.circle(padding + noseSize/2, noseY, noseSize);
                break;
              case 'up':
                graphics.circle(noseX, padding + noseSize/2, noseSize);
                break;
              case 'down':
                graphics.circle(noseX, padding + segmentSize - noseSize/2, noseSize);
                break;
            }
            graphics.fill({ 
              color: 0x00FF00,
              alpha: 1
            });

            // Добавляем эффект градиента для головы с учетом направления
            const gradientPadding = 2;
            switch (snakeRef.current.direction) {
              case 'right':
                graphics.rect(padding + gradientPadding, padding + gradientPadding, 
                            segmentSize/2, segmentSize - gradientPadding*2, headRadius);
                break;
              case 'left':
                graphics.rect(padding + segmentSize/2, padding + gradientPadding, 
                            segmentSize/2 - gradientPadding, segmentSize - gradientPadding*2, headRadius);
                break;
              case 'up':
                graphics.rect(padding + gradientPadding, padding + segmentSize/2, 
                            segmentSize - gradientPadding*2, segmentSize/2 - gradientPadding, headRadius);
                break;
              case 'down':
                graphics.rect(padding + gradientPadding, padding + gradientPadding, 
                            segmentSize - gradientPadding*2, segmentSize/2, headRadius);
                break;
            }
            graphics.fill({ 
              color: 0x90EE90,
              alpha: 0.3
            });

            // Глаза - делаем их расположение зависимым от направления
            const eyeSize = 3;
            const eyeInnerSize = 1.5;
            const eyeSpacing = 8; // Расстояние между глазами
            let leftEyeX, leftEyeY, rightEyeX, rightEyeY;
            
            switch (snakeRef.current.direction) {
              case 'right':
                leftEyeX = padding + segmentSize - 8;
                rightEyeX = leftEyeX;
                leftEyeY = padding + (segmentSize/2) - eyeSpacing/2;
                rightEyeY = padding + (segmentSize/2) + eyeSpacing/2;
                break;
              case 'left':
                leftEyeX = padding + 8;
                rightEyeX = leftEyeX;
                leftEyeY = padding + (segmentSize/2) - eyeSpacing/2;
                rightEyeY = padding + (segmentSize/2) + eyeSpacing/2;
                break;
              case 'up':
                leftEyeY = padding + 8;
                rightEyeY = leftEyeY;
                leftEyeX = padding + (segmentSize/2) - eyeSpacing/2;
                rightEyeX = padding + (segmentSize/2) + eyeSpacing/2;
                break;
              case 'down':
                leftEyeY = padding + segmentSize - 8;
                rightEyeY = leftEyeY;
                leftEyeX = padding + (segmentSize/2) - eyeSpacing/2;
                rightEyeX = padding + (segmentSize/2) + eyeSpacing/2;
                break;
            }
            
            // Рисуем глаза
            graphics.circle(leftEyeX, leftEyeY, eyeSize);
            graphics.fill({ color: 0xFFFFFF });
            graphics.circle(rightEyeX, rightEyeY, eyeSize);
            graphics.fill({ color: 0xFFFFFF });
            
            // Зрачки
            graphics.circle(leftEyeX, leftEyeY, eyeInnerSize);
            graphics.fill({ color: 0x000000 });
            graphics.circle(rightEyeX, rightEyeY, eyeInnerSize);
            graphics.fill({ color: 0x000000 });

            // Блики в глазах
            const shineSize = 0.8;
            graphics.circle(leftEyeX - 0.5, leftEyeY - 0.5, shineSize);
            graphics.fill({ color: 0xFFFFFF });
            graphics.circle(rightEyeX - 0.5, rightEyeY - 0.5, shineSize);
            graphics.fill({ color: 0xFFFFFF });

            // Язычок - адаптируем под новую форму головы
            const tongueWidth = 2;
            const tongueLength = 4;
            let tongueStartX, tongueStartY, tongueEndX, tongueEndY;
            
            switch (snakeRef.current.direction) {
              case 'right':
                tongueStartX = padding + segmentSize - 2;
                tongueStartY = padding + segmentSize/2;
                tongueEndX = tongueStartX + tongueLength;
                tongueEndY = tongueStartY;
                break;
              case 'left':
                tongueStartX = padding + 2;
                tongueStartY = padding + segmentSize/2;
                tongueEndX = tongueStartX - tongueLength;
                tongueEndY = tongueStartY;
                break;
              case 'up':
                tongueStartX = padding + segmentSize/2;
                tongueStartY = padding + 2;
                tongueEndX = tongueStartX;
                tongueEndY = tongueStartY - tongueLength;
                break;
              case 'down':
                tongueStartX = padding + segmentSize/2;
                tongueStartY = padding + segmentSize - 2;
                tongueEndX = tongueStartX;
                tongueEndY = tongueStartY + tongueLength;
                break;
            }

            if (snakeRef.current.direction !== 'up') {
              // Основание язычка
              graphics.rect(tongueStartX - tongueWidth/2, tongueStartY - tongueWidth/2, 
                          Math.abs(tongueEndX - tongueStartX) || tongueWidth,
                          Math.abs(tongueEndY - tongueStartY) || tongueWidth);
              graphics.fill({ color: 0xFF69B4 });

              // Раздвоенный кончик язычка
              if (snakeRef.current.direction !== 'down') {
                const forkSize = 2;
                graphics.moveTo(tongueEndX, tongueEndY);
                switch (snakeRef.current.direction) {
                  case 'right':
                    graphics.lineTo(tongueEndX + forkSize, tongueEndY - forkSize);
                    graphics.lineTo(tongueEndX + forkSize, tongueEndY + forkSize);
                    break;
                  case 'left':
                    graphics.lineTo(tongueEndX - forkSize, tongueEndY - forkSize);
                    graphics.lineTo(tongueEndX - forkSize, tongueEndY + forkSize);
                    break;
                }
                graphics.closePath();
                graphics.fill({ color: 0xFF69B4 });
              }
            }
          } else {
            // Тело змеи
            const segmentPadding = 1;
            const isFirstBodySegment = index === 1;
            const bodyRadius = isFirstBodySegment ? 6 : 4; // Увеличенный радиус для первого сегмента
            
            // Основной цвет сегмента
            graphics.rect(padding, padding, segmentSize, segmentSize, bodyRadius);
            graphics.fill({ 
              color: isFirstBodySegment ? 0x00DD00 : 0x00CC00, // Немного светлее для первого сегмента
              alpha: 0.9 - (index * 0.005)
            });

            // Добавляем чешуйки
            const scaleSize = isFirstBodySegment ? 4.5 : 4; // Чуть большие чешуйки для первого сегмента
            const scaleRows = 3;
            const scaleCols = 3;
            const scaleSpacing = (segmentSize - scaleSize) / (scaleCols - 1);
            
            for (let row = 0; row < scaleRows; row++) {
              for (let col = 0; col < scaleCols; col++) {
                const scaleX = padding + col * scaleSpacing;
                const scaleY = padding + row * scaleSpacing;
                
                // Рисуем чешуйку
                graphics.moveTo(scaleX, scaleY + scaleSize);
                graphics.arc(scaleX + scaleSize/2, scaleY + scaleSize/2, scaleSize/2, Math.PI, 0);
                graphics.fill({ 
                  color: isFirstBodySegment ? 0x009900 : 0x008800,
                  alpha: 0.3 - (index * 0.01)
                });
              }
            }

            // Добавляем блики на чешуйках
            for (let row = 0; row < scaleRows; row++) {
              for (let col = 0; col < scaleCols; col++) {
                const scaleX = padding + col * scaleSpacing;
                const scaleY = padding + row * scaleSpacing;
                
                // Маленький блик на каждой чешуйке
                graphics.circle(scaleX + scaleSize/2, scaleY + scaleSize/2, isFirstBodySegment ? 0.7 : 0.5);
                graphics.fill({ 
                  color: 0x90EE90,
                  alpha: isFirstBodySegment ? 0.5 : (0.4 - (index * 0.01))
                });
              }
            }

            // Добавляем эффект тени между сегментами
            if (index > 0) {
              const shadowWidth = isFirstBodySegment ? 3 : 2;
              graphics.rect(padding, padding, shadowWidth, segmentSize, 0);
              graphics.fill({ 
                color: 0x006600,
                alpha: isFirstBodySegment ? 0.25 : 0.3
              });
            }

            // Добавляем боковые блики для объема
            const sideHighlightWidth = isFirstBodySegment ? 3 : 2;
            graphics.rect(padding + segmentSize - sideHighlightWidth, padding, sideHighlightWidth, segmentSize, 0);
            graphics.fill({ 
              color: 0x90EE90,
              alpha: isFirstBodySegment ? 0.25 : (0.2 - (index * 0.005))
            });

            // Верхний блик для объема
            graphics.rect(padding, padding, segmentSize, sideHighlightWidth, 0);
            graphics.fill({ 
              color: 0x90EE90,
              alpha: isFirstBodySegment ? 0.3 : (0.25 - (index * 0.005))
            });
          }
          
          // Используем текущие анимированные позиции
          const current = currentPositionsRef.current[index];
          if (current) {
            graphics.x = current.x;
            graphics.y = current.y;
          } else {
            graphics.x = segment.x * GRID_SIZE;
            graphics.y = segment.y * GRID_SIZE;
          }
          
          container.addChild(graphics);
        });
      };

      // Добавляем ticker для плавной анимации
      app.ticker.maxFPS = ANIMATION_FPS; // Устанавливаем фиксированную частоту кадров
      app.ticker.add(() => {
        if (gameOver) return;

        // Оптимизируем анимацию движения
        snakeRef.current.body.forEach((segment, index) => {
          const targetX = segment.x * GRID_SIZE;
          const targetY = segment.y * GRID_SIZE;
          
          if (!currentPositionsRef.current[index]) {
            currentPositionsRef.current[index] = { x: targetX, y: targetY };
            return;
          }

          const current = currentPositionsRef.current[index];
          
          // Определяем, находится ли сегмент в процессе поворота
          const isTurning = index > 0 && (
            (snakeRef.current.body[index-1].x !== segment.x && snakeRef.current.body[index-1].y !== segment.y) ||
            (index < snakeRef.current.body.length - 1 && snakeRef.current.body[index+1].x !== segment.x && snakeRef.current.body[index+1].y !== segment.y)
          );

          const dx = targetX - current.x;
          const dy = targetY - current.y;
          
          // Применяем улучшенную систему плавности движения
          let smoothness;
          
          if (index === 0) {
            // Для головы используем базовую плавность движения
            smoothness = isTurning ? currentSpeed.TURN_SMOOTHNESS : currentSpeed.MOVEMENT_SMOOTHNESS;
          } else {
            // Для тела используем интерполяцию между плавностью головы и хвоста
            const progress = index / (snakeRef.current.body.length - 1);
            const baseSmooth = isTurning ? currentSpeed.TURN_SMOOTHNESS : currentSpeed.MOVEMENT_SMOOTHNESS;
            smoothness = baseSmooth + (currentSpeed.TAIL_SMOOTHNESS - baseSmooth) * progress;
          }
          
          // Применяем плавное движение с улучшенной интерполяцией
          const ease = (1.0 - Math.pow(1.0 - smoothness, app.ticker.deltaTime));
          
          // Уменьшаем порог для более точного позиционирования
          const threshold = 0.01;
          
          if (Math.abs(dx) < threshold) {
            current.x = targetX;
          } else {
            current.x += dx * ease;
          }
          
          if (Math.abs(dy) < threshold) {
            current.y = targetY;
          } else {
            current.y += dy * ease;
          }

          // Увеличиваем точность округления
          current.x = Math.round(current.x * 1000) / 1000;
          current.y = Math.round(current.y * 1000) / 1000;
        });

        drawSnake();
      });

      // Игровой цикл
      const gameLoop = setInterval(() => {
        if (gameOver) {
          clearInterval(gameLoop);
          return;
        }

        const currentTime = Date.now();
        const snake = snakeRef.current;

        // Обрабатываем буфер команд
        if (inputBufferRef.current.length > 0) {
          // Берем самую раннюю команду из буфера
          const nextInput = inputBufferRef.current[0];
          
          // Проверяем возможность выполнения команды
          const isValidMove = isValidDirectionChange(snake.direction, nextInput.direction);
          
          if (isValidMove) {
            snake.nextDirection = nextInput.direction;
            inputBufferRef.current.shift();
          } else if (inputBufferRef.current.length > 1) {
            // Если первая команда невалидна, но есть вторая, пробуем её
            const secondInput = inputBufferRef.current[1];
            if (isValidDirectionChange(snake.direction, secondInput.direction)) {
              snake.nextDirection = secondInput.direction;
              inputBufferRef.current = [inputBufferRef.current[0]];
            }
          }
        }

        snake.direction = snake.nextDirection;
        const head = { ...snake.body[0] };

        switch (snake.direction) {
          case 'up':
            head.y -= 1;
            break;
          case 'down':
            head.y += 1;
            break;
          case 'left':
            head.x -= 1;
            break;
          case 'right':
            head.x += 1;
            break;
        }

        if (
          head.x < 0 ||
          head.x >= GRID_WIDTH ||
          head.y < 0 ||
          head.y >= GRID_HEIGHT
        ) {
          setGameOver(true);
          return;
        }

        if (snake.body.some(segment => segment.x === head.x && segment.y === head.y)) {
          setGameOver(true);
          return;
        }

        snake.body.unshift(head);
        
        // Обновляем массив текущих позиций при добавлении нового сегмента
        currentPositionsRef.current.unshift({
          x: currentPositionsRef.current[0]?.x || head.x * GRID_SIZE,
          y: currentPositionsRef.current[0]?.y || head.y * GRID_SIZE
        });

        if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
          foodRef.current = generateFood();
          foodSpriteRef.current.x = foodRef.current.x * GRID_SIZE;
          foodSpriteRef.current.y = foodRef.current.y * GRID_SIZE;
          setScore(prev => prev + 1);
        } else {
          snake.body.pop();
          currentPositionsRef.current.pop();
        }
      }, currentSpeed.GAME_SPEED);

      // Функция очистки
      cleanupRef.current = () => {
        clearInterval(gameLoop);
        if (appRef.current) {
          try {
            if (appRef.current.ticker) {
              appRef.current.ticker.stop();
            }
            if (appRef.current.stage) {
              appRef.current.stage.removeChildren();
            }
            if (containerRef.current && appRef.current.canvas) {
              containerRef.current.removeChild(appRef.current.canvas);
            }
            appRef.current.destroy(true);
          } catch (error) {
            console.error('Error during cleanup:', error);
          } finally {
            appRef.current = null;
            isInitializedRef.current = false;
          }
        }
      };

      return cleanupRef.current;
    });
  }, [gameOver, gameStarted]);

  // Очистка при размонтировании или смене сложности
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  const returnToMenu = () => {
    // Полностью очищаем игру
    if (cleanupRef.current) {
      cleanupRef.current();
    }
    
    // Сбрасываем все рефы
    snakeRef.current = {
      body: [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
      ],
      direction: 'right',
      nextDirection: 'right',
    };
    foodRef.current = { x: 15, y: 10 };
    currentPositionsRef.current = [];
    inputBufferRef.current = [];
    lastValidCommandRef.current = null;
    isInitializedRef.current = false;
    
    // Сбрасываем состояния
    setGameStarted(false);
    setGameOver(false);
    setScore(0);
    setDifficulty(null);
    
    // Возвращаемся в главное меню
    if (onReturnToMenu) {
      onReturnToMenu();
    }
  };

  const startGame = (selectedDifficulty) => {
    // Сначала очищаем предыдущую игру, если она была
    if (cleanupRef.current) {
      cleanupRef.current();
    }
    
    // Сбрасываем состояние
    isInitializedRef.current = false;
    currentSpeed = DIFFICULTY_PRESETS[selectedDifficulty];
    
    // Инициализируем начальное состояние змейки
    snakeRef.current = {
      body: [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
      ],
      direction: 'right',
      nextDirection: 'right',
    };
    
    foodRef.current = { x: 15, y: 10 };
    currentPositionsRef.current = [];
    inputBufferRef.current = [];
    lastValidCommandRef.current = null;
    
    // Очищаем контейнер, если он существует
    if (snakeContainerRef.current) {
      snakeContainerRef.current.removeChildren();
    }
    
    // Очищаем canvas, если он существует
    if (containerRef.current) {
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }
    }
    
    // Устанавливаем сложность и запускаем игру
    setDifficulty(selectedDifficulty);
    setGameOver(false);
    setScore(0);
    
    // Запускаем игру после небольшой задержки, чтобы состояния успели обновиться
    setTimeout(() => {
      setGameStarted(true);
    }, 0);
  };

  const restartGame = () => {
    if (snakeContainerRef.current) {
      snakeContainerRef.current.removeChildren();
    }
    
    setGameOver(false);
    setScore(0);
    snakeRef.current = {
      body: [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
      ],
      direction: 'right',
      nextDirection: 'right',
    };
    foodRef.current = { x: 15, y: 10 };
    
    // Сбрасываем текущие позиции
    currentPositionsRef.current = snakeRef.current.body.map(segment => ({
      x: segment.x * GRID_SIZE,
      y: segment.y * GRID_SIZE
    }));
  };

  return (
    <div style={{ 
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      borderRadius: '15px',
      backgroundColor: 'rgba(0,0,0,0.7)',
      boxShadow: '0 0 20px rgba(0,255,0,0.1)'
    }}>
      {!gameStarted ? (
        <div style={{
          textAlign: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)',
          padding: '20px',
          borderRadius: '10px',
          width: '300px'
        }}>
          <h2 style={{ color: 'white', marginBottom: '20px' }}>Select Difficulty</h2>
          {Object.entries(DIFFICULTY_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => startGame(key)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px',
                margin: '10px 0',
                fontSize: '16px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                transition: 'background-color 0.3s ease'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#45a049'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#4CAF50'}
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            color: 'white',
            fontSize: '14px',
            fontFamily: 'Arial',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: '5px 10px',
            borderRadius: '5px'
          }}>
            Difficulty: {DIFFICULTY_PRESETS[difficulty].label}
          </div>
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '10px',
            color: 'white'
          }}>
            <h2>Score: {score}</h2>
            {gameOver && (
              <div>
                <h3>Game Over!</h3>
                <button 
                  onClick={restartGame}
                  style={{
                    padding: '10px 20px',
                    margin: '0 10px',
                    fontSize: '16px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    transition: 'background-color 0.3s ease'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#45a049'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#4CAF50'}
                >
                  Play Again
                </button>
                <button 
                  onClick={returnToMenu}
                  style={{
                    padding: '10px 20px',
                    margin: '0 10px',
                    fontSize: '16px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    transition: 'background-color 0.3s ease'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#d32f2f'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#f44336'}
                >
                  Main Menu
                </button>
              </div>
            )}
          </div>
          <div ref={containerRef} style={{ 
            width: GRID_WIDTH * GRID_SIZE, 
            height: GRID_HEIGHT * GRID_SIZE,
            borderRadius: '10px',
            overflow: 'hidden'
          }} />
        </>
      )}
    </div>
  );
};

export default SnakeGame; 