// Регистрация Service Worker для кеширования ресурсов
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("js/sw.js").catch((err) => {
    console.error("Ошибка регистрации Service Worker:", err);
  });
}

// Основной код игры
document.addEventListener("DOMContentLoaded", () => {
  // Получение всех нужных элементов DOM
  const elements = {
    gameContainer: document.getElementById("game-container"),
    player: document.getElementById("player"),
    menuContainer: document.getElementById("menu-container"),
    playButton: document.getElementById("play-button"),
    gameOverScreen: document.getElementById("game-over-screen"),
    finalScoreDisplay: document.getElementById("final-score"),
    highScoreDisplay: document.getElementById("high-score"),
    playAgainButton: document.getElementById("play-again-button"),
  };

  // Проверка наличия всех элементов
  if (Object.values(elements).some((element) => !element)) {
    console.error("Критическая ошибка: не найдены необходимые элементы!");
    return;
  }

  // Игровые переменные
  let gameInterval = null;
  let difficultyIncreaseInterval = null;
  let obstacleSpawnTimeout = null;
  let itemSpawnTimeout = null;
  let score = 0;
  let highScore = parseInt(localStorage.getItem("highScore")) || 0;
  elements.highScoreDisplay.textContent = highScore;

  // Массивы для хранения объектов
  let obstacles = [];
  let itemsToCollect = [];

  // Настройки игрока
  const playerSettings = {
    speed: 5,
    x: Math.floor(elements.gameContainer.offsetWidth / 2),
    movingLeft: false,
    movingRight: false,
    isTouchActive: false,
    touchStartX: 0,
    width: 40, // Ширина корабля
  };

  // Настройки игры
  const gameSettings = {
    obstacleSpeed: 2,
    itemSpeed: 2,
    spawnDelayRange: { min: 500, max: 2000 },
    obstacleCreationChance: 0.2,
    itemCreationChance: 0.2,
    difficultyLevel: 1,
    maxObjects: 30,
    difficultyIncrease: {
      interval: 10000, // Интервал увеличения сложности
      speedIncrement: 0.5,
      chanceIncrement: 0.05,
    },
  };

  // Пути к изображениям
  const gameAssets = {
    deathAnimation: [
      "./img/bomb-1.svg",
      "./img/bomb-2.svg",
      "./img/bomb-3.svg",
    ],
    countdownFrames: [
      "./img/three.svg",
      "./img/two.svg",
      "./img/one.svg",
      "./img/go.svg",
    ],
  };

  // Инициализация звуков
  const sounds = {
    background: new Audio("../sounds/sound-play.mp3"),
    death: new Audio("../sounds/death-sound.mp3"),
    deathFinal: new Audio("../sounds/death-sound-2.mp3"),
    coin: new Audio("../sounds/coins.mp3"),
    countdown: {
      three: new Audio("../sounds/go-1.mp3"),
      two: new Audio("../sounds/go-2.mp3"),
      one: new Audio("../sounds/go-3.mp3"),
      go: new Audio("../sounds/go-start.mp3"),
    },
  };

  // Настройка звуков
  function initializeSounds() {
    sounds.background.loop = true;
    sounds.background.volume = 0;

    // Настройка громкости для всех звуков отсчёта
    Object.values(sounds.countdown).forEach((sound) => {
      sound.volume = 0.7;
    });

    sounds.death.volume = 1.0;
    sounds.deathFinal.volume = 1.0;
    sounds.coin.volume = 0.6;
  }

  // Управление фоновой музыкой
  const musicController = {
    fadeIn() {
      let volume = 0;
      const fadeInterval = setInterval(() => {
        if (volume < 0.5) {
          volume += 0.05;
          sounds.background.volume = volume;
        } else {
          sounds.background.volume = 0.5;
          clearInterval(fadeInterval);
        }
      }, 100);
    },

    fadeOut() {
      const fadeInterval = setInterval(() => {
        if (sounds.background.volume > 0.1) {
          sounds.background.volume -= 0.1;
        } else {
          sounds.background.volume = 0;
          sounds.background.pause();
          clearInterval(fadeInterval);
        }
      }, 100);
    },
  };

  // Функция отсчёта перед началом игры
  function playCountdown(callback) {
    const ui = createCountdownUI();
    let count = 0;

    function showNextNumber() {
      if (count >= gameAssets.countdownFrames.length) {
        animateCountdownEnd(ui, callback);
        return;
      }

      updateCountdownDisplay(ui, count);
      playCountdownSound(count);
      count++;
      setTimeout(showNextNumber, 1000);
    }

    showNextNumber();
  }

  // Создание UI элементов отсчёта
  function createCountdownUI() {
    const container = document.createElement("div");
    const overlay = document.createElement("div");

    setupCountdownContainer(container);
    setupCountdownOverlay(overlay);

    elements.gameContainer.appendChild(overlay);
    elements.gameContainer.appendChild(container);

    return { container, overlay };
  }

  // Настройка контейнера отсчёта
  function setupCountdownContainer(container) {
    Object.assign(container.style, {
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      zIndex: "1000",
    });
  }

  // Настройка оверлея отсчёта
  function setupCountdownOverlay(overlay) {
    Object.assign(overlay.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: "100%",
      height: "100%",
      backgroundColor: "black",
      zIndex: "999",
    });
  }

  // Обновление отображения отсчёта
  function updateCountdownDisplay(ui, count) {
    ui.container.innerHTML = "";
    const img = document.createElement("img");
    img.src = gameAssets.countdownFrames[count];
    img.style.width = "150px";
    img.style.height = "150px";
    img.classList.add("countdown-number");
    ui.container.appendChild(img);
  }

  // Проигрывание звука отсчёта
  function playCountdownSound(count) {
    const soundKey = ["three", "two", "one", "go"][count];
    const sound = sounds.countdown[soundKey];
    sound.currentTime = 0;
    sound.play().catch(console.error);
  }

  // Анимация окончания отсчёта
  function animateCountdownEnd(ui, callback) {
    ui.container.style.transition = "transform 0.5s ease-in-out";
    ui.overlay.style.transition = "transform 0.5s ease-in-out";
    ui.container.style.transform = "translate(-50%, -150%)";
    ui.overlay.style.transform = "translateY(-100%)";

    setTimeout(() => {
      ui.container.remove();
      ui.overlay.remove();
      callback();
    }, 500);
  }

  // Запуск игры
  function startGame() {
    resetGameState();
    elements.menuContainer.style.top = "-100%";
    elements.gameContainer.style.display = "block";
    elements.gameOverScreen.style.top = "100%";

    playCountdown(() => {
      initializeGameSession();
    });
  }

  // Сброс игрового состояния
  function resetGameState() {
    score = 0;
    clearAllObjects();
    resetPlayerPosition();
    resetGameSettings();
  }

  // Очистка всех объектов
  function clearAllObjects() {
    [...obstacles, ...itemsToCollect].forEach((obj) => obj.remove());
    obstacles = [];
    itemsToCollect = [];
  }

  // Инициализация игровой сессии
  function initializeGameSession() {
    sounds.background.currentTime = 0;
    sounds.background.play().catch(console.error);
    musicController.fadeIn();

    clearAllIntervals();
    startGameLoops();
  }

  // Очистка всех интервалов
  function clearAllIntervals() {
    [gameInterval, difficultyIncreaseInterval].forEach(clearInterval);
    [obstacleSpawnTimeout, itemSpawnTimeout].forEach(clearTimeout);
  }

  // Запуск игровых циклов
  function startGameLoops() {
    gameInterval = setInterval(gameLoop, 20);
    difficultyIncreaseInterval = setInterval(
      increaseDifficulty,
      gameSettings.difficultyIncrease.interval
    );
    spawnObstacles();
    spawnItems();
  }

  // Основной игровой цикл
  function gameLoop() {
    updatePlayerPosition();
    moveObjects();
  }

  // Сброс игры
  function resetGame() {
    clearAllIntervals();
    clearAllObjects();

    // Сброс состояния всех звуков
    sounds.background.pause();
    sounds.background.currentTime = 0;
    sounds.death.pause();
    sounds.death.currentTime = 0;
    sounds.deathFinal.pause();
    sounds.deathFinal.currentTime = 0;

    // Восстановление начальной громкости
    sounds.background.volume = 0.5;
    sounds.death.volume = 1.0;
    sounds.deathFinal.volume = 1.0;

    // Очищаем все изображения взрывов
    const explosionImages = elements.gameContainer.querySelectorAll("img");
    explosionImages.forEach((img) => img.remove());

    // Скрываем экран Game Over
    elements.gameOverScreen.style.display = "none";
    elements.player.style.display = "block";

    // Сразу запускаем отсчет
    startGame();
  }

  // Обновление позиции игрока
  function updatePlayerPosition() {
    const containerWidth = elements.gameContainer.offsetWidth;
    const playerWidth = elements.player.offsetWidth;

    // Проверяем границы перед движением
    if (playerSettings.movingLeft) {
      // Не даем выйти за левый край
      playerSettings.x = Math.max(0, playerSettings.x - playerSettings.speed);
    }
    if (playerSettings.movingRight) {
      // Не даем выйти за правый край
      playerSettings.x = Math.min(
        containerWidth - playerWidth,
        playerSettings.x + playerSettings.speed
      );
    }

    // Дополнительная проверка на случай изменения размера окна
    playerSettings.x = Math.max(
      0,
      Math.min(containerWidth - playerWidth, playerSettings.x)
    );

    elements.player.style.left = `${playerSettings.x}px`;
  }

  // Создание препятствия
  function createObstacle() {
    if (obstacles.length >= gameSettings.maxObjects / 2) return;

    const obstacle = document.createElement("div");
    obstacle.classList.add("asteroid");
    obstacle.style.left = `${
      Math.random() * (elements.gameContainer.offsetWidth - 40)
    }px`;
    obstacle.style.top = "-30px";
    elements.gameContainer.appendChild(obstacle);
    obstacles.push(obstacle);
  }

  // Создание предмета
  function createItem() {
    if (itemsToCollect.length >= gameSettings.maxObjects / 2) return;

    const item = document.createElement("div");
    item.classList.add("cosmonavt");
    item.style.left = `${
      Math.random() * (elements.gameContainer.offsetWidth - 40)
    }px`;
    item.style.top = "-30px";
    elements.gameContainer.appendChild(item);
    itemsToCollect.push(item);
  }

  // Движение объектов
  function moveObjects() {
    const containerHeight = elements.gameContainer.offsetHeight;

    obstacles = obstacles.filter((obstacle) => {
      const obstacleTop =
        parseFloat(obstacle.style.top) + gameSettings.obstacleSpeed;
      obstacle.style.top = `${obstacleTop}px`;

      if (obstacleTop > containerHeight) {
        obstacle.remove();
        return false;
      }
      checkCollision(obstacle, "obstacle");
      return true;
    });

    itemsToCollect = itemsToCollect.filter((item) => {
      const itemTop = parseFloat(item.style.top) + gameSettings.itemSpeed;
      item.style.top = `${itemTop}px`;

      if (itemTop > containerHeight) {
        item.remove();
        return false;
      }
      checkCollision(item, "item");
      return true;
    });
  }

  // Проверка столкновений
  function checkCollision(object, type) {
    const playerRect = elements.player.getBoundingClientRect();
    const objectRect = object.getBoundingClientRect();

    if (
      !(
        playerRect.right < objectRect.left ||
        playerRect.left > objectRect.right ||
        playerRect.bottom < objectRect.top ||
        playerRect.top > objectRect.bottom
      )
    ) {
      if (type === "obstacle") {
        endGame();
      } else {
        score++;
        object.remove();
        // Воспроизводим звук монеты при сборе космонавта
        const coinSoundInstance = new Audio(sounds.coin.src);
        coinSoundInstance.volume = sounds.coin.volume;
        coinSoundInstance.play();
      }
    }
  }

  // Завершение игры
  function endGame() {
    clearAllIntervals();
    musicController.fadeOut();
    playDeathAnimation();
  }

  // Показ экрана Game Over
  function showGameOverScreen() {
    elements.gameOverScreen.style.display = "flex";
    // Задержка перед появлением экрана Game Over
    setTimeout(() => {
      elements.gameOverScreen.style.top = "0%";
      elements.finalScoreDisplay.textContent = score;
      if (score > highScore) {
        highScore = score;
        localStorage.setItem("highScore", highScore);
        elements.highScoreDisplay.textContent = highScore;
      }
    }, 1000); // 1 секунд задержки
  }

  // Анимация смерти
  function playDeathAnimation() {
    const playerX = elements.player.offsetLeft;
    const playerY = elements.player.offsetTop;
    elements.player.style.display = "none";

    let animationFrame = 0;
    const explosionContainer = document.createElement("div");
    explosionContainer.style.position = "absolute";
    explosionContainer.style.left = `${playerX}px`;
    explosionContainer.style.top = `${playerY}px`;
    explosionContainer.style.pointerEvents = "none";

    // Начинаем воспроизведение звуков сразу с первым кадром анимации
    playDeathSoundMultipleTimes(3);

    const animate = () => {
      if (animationFrame >= gameAssets.deathAnimation.length) {
        explosionContainer.remove();
        showGameOverScreen();
        return;
      }

      explosionContainer.innerHTML = "";
      const img = document.createElement("img");
      img.src = gameAssets.deathAnimation[animationFrame];
      img.style.width = "70px";
      img.style.height = "70px";
      img.style.animation = "explosionFrame 0.3s forwards";

      explosionContainer.appendChild(img);
      animationFrame++;

      requestAnimationFrame(() => {
        setTimeout(() => {
          requestAnimationFrame(animate);
        }, 300);
      });
    };

    elements.gameContainer.appendChild(explosionContainer);
    animate();
  }

  // Сброс позиции игрока
  function resetPlayerPosition() {
    // Центрируем корабль по горизонтали
    const centerX =
      (elements.gameContainer.offsetWidth - elements.player.offsetWidth) / 2;
    playerSettings.x = centerX;
    elements.player.style.left = `${centerX}px`;
    elements.player.style.display = "block";
  }

  // Сброс настроек игры
  function resetGameSettings() {
    gameSettings.obstacleSpeed = 2;
    gameSettings.itemSpeed = 2;
    gameSettings.spawnDelayRange = { min: 500, max: 2000 };
    gameSettings.obstacleCreationChance = 0.2;
    gameSettings.itemCreationChance = 0.2;
    gameSettings.difficultyLevel = 1;
  }

  // Увеличение сложности игры
  function increaseDifficulty() {
    gameSettings.difficultyLevel++;
    gameSettings.obstacleSpeed = Math.min(
      8,
      gameSettings.obstacleSpeed +
        gameSettings.difficultyIncrease.speedIncrement
    );
    gameSettings.itemSpeed = Math.min(
      8,
      gameSettings.itemSpeed + gameSettings.difficultyIncrease.speedIncrement
    );

    gameSettings.obstacleCreationChance = Math.min(
      0.5,
      gameSettings.obstacleCreationChance +
        gameSettings.difficultyIncrease.chanceIncrement
    );
    gameSettings.itemCreationChance = Math.min(
      0.5,
      gameSettings.itemCreationChance +
        gameSettings.difficultyIncrease.chanceIncrement
    );

    gameSettings.spawnDelayRange.max = Math.max(
      500,
      gameSettings.spawnDelayRange.max - 100
    );
  }

  // Спавн препятствий
  function spawnObstacles() {
    if (Math.random() < gameSettings.obstacleCreationChance) {
      createObstacle();
    }
    obstacleSpawnTimeout = setTimeout(
      spawnObstacles,
      Math.random() *
        (gameSettings.spawnDelayRange.max - gameSettings.spawnDelayRange.min) +
        gameSettings.spawnDelayRange.min
    );
  }

  // Спавн предметов
  function spawnItems() {
    if (Math.random() < gameSettings.itemCreationChance) {
      createItem();
    }
    itemSpawnTimeout = setTimeout(
      spawnItems,
      Math.random() *
        (gameSettings.spawnDelayRange.max - gameSettings.spawnDelayRange.min) +
        gameSettings.spawnDelayRange.min
    );
  }

  // Проигрывание звука смерти несколько раз
  function playDeathSoundMultipleTimes(times = 3) {
    let playCount = 0;

    function playNextSound() {
      if (playCount < times) {
        const soundInstance = new Audio(sounds.death.src);
        soundInstance.volume = 1.0;
        soundInstance.playbackRate = 1.0;
        soundInstance.play();
        playCount++;

        // Синхронизируем интервал звуков с интервалом анимации
        setTimeout(playNextSound, 300);
      } else if (playCount === times) {
        setTimeout(() => {
          sounds.deathFinal.currentTime = 0;
          sounds.deathFinal.play();
        }, 300); // Теперь финальный звук также синхронизирован с анимацией
      }
    }

    playNextSound();
  }

  // Настройка управления
  function setupControls() {
    elements.gameContainer.tabIndex = 0;
    elements.gameContainer.focus();

    elements.gameContainer.addEventListener(
      "keydown",
      (e) => {
        if (e.target === elements.gameContainer) {
          e.preventDefault();
          e.stopPropagation();
          if (e.key === "ArrowLeft") playerSettings.movingLeft = true;
          if (e.key === "ArrowRight") playerSettings.movingRight = true;
        }
      },
      { capture: true }
    );

    elements.gameContainer.addEventListener(
      "keyup",
      (e) => {
        if (e.target === elements.gameContainer) {
          e.preventDefault();
          e.stopPropagation();
          if (e.key === "ArrowLeft") playerSettings.movingLeft = false;
          if (e.key === "ArrowRight") playerSettings.movingRight = false;
        }
      },
      { capture: true }
    );

    elements.player.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        playerSettings.isTouchActive = true;
        playerSettings.touchStartX = e.touches[0].clientX;
      },
      { passive: false }
    );

    elements.player.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        if (playerSettings.isTouchActive) {
          const touchX = e.touches[0].clientX;
          const deltaX = touchX - playerSettings.touchStartX;
          const containerWidth = elements.gameContainer.offsetWidth;
          const playerWidth = elements.player.offsetWidth;

          // Рассчитываем новую позицию с учетом границ
          const newX = playerSettings.x + deltaX;
          playerSettings.x = Math.max(
            0,
            Math.min(containerWidth - playerWidth, newX)
          );

          playerSettings.touchStartX = touchX;
          updatePlayerPosition();
        }
      },
      { passive: false }
    );

    elements.player.addEventListener("touchend", () => {
      playerSettings.isTouchActive = false;
    });
    elements.player.addEventListener("touchcancel", () => {
      playerSettings.isTouchActive = false;
    });
  }

  // Инициализация игры
  initializeSounds();
  elements.playButton.addEventListener("click", startGame);
  elements.playAgainButton.addEventListener("click", resetGame);
  setupControls();
});
