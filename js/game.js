// Регистрация Service Worker для кеширования ресурсов
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./js/sw.js").catch((err) => {
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
    cosmonautCounter: document.getElementById("cosmonaut-count"),
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
  let cosmonautsCollected = 0;
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

  // аудио менеджер с использованием Howler.js
  const audioManager = {
    sounds: {},
    initialized: false,

    init() {
      try {
        this.initializeAudio();
        this.initialized = true;
      } catch (e) {
        console.error("Ошибка инициализации аудио:", e);
      }
    },

    initializeAudio() {
      const soundsList = {
        background: "./sounds/sound-play.mp3",
        death: "./sounds/death-sound.mp3",
        deathFinal: "./sounds/death-sound-2.mp3",
        coin: "./sounds/coins.mp3",
        countdown3: "./sounds/go-1.mp3",
        countdown2: "./sounds/go-2.mp3",
        countdown1: "./sounds/go-3.mp3",
        countdownGo: "./sounds/go-start.mp3",
      };

      Object.entries(soundsList).forEach(([key, url]) => {
        this.sounds[key] = new Howl({
          src: [url],
          preload: true,
        });
      });
    },

    play(soundName, { loop = false, volume = 1.0 } = {}) {
      try {
        const sound = this.sounds[soundName];
        if (!sound) return null;

        sound.loop(loop);
        sound.volume(volume);
        sound.play();

        return {
          stop: () => sound.stop(),
          setVolume: (value) => sound.volume(value),
        };
      } catch (e) {
        console.warn(`Ошибка воспроизведения звука ${soundName}:`, e);
        return null;
      }
    },

    stopAll() {
      Object.values(this.sounds).forEach((sound) => sound.stop());
    },
  };

  // музыкальный контроллер
  const musicController = {
    currentMusic: null,
    fadeInterval: null,

    playBackground() {
      try {
        if (this.currentMusic) {
          this.currentMusic.stop();
        }

        this.currentMusic = audioManager.play("background", {
          loop: true,
          volume: 0,
        });

        if (this.currentMusic) {
          this.fadeIn();
        }
      } catch (e) {
        console.warn("Ошибка воспроизведения фоновой музыки:", e);
      }
    },

    fadeIn() {
      clearInterval(this.fadeInterval);
      let volume = 0;
      this.fadeInterval = setInterval(() => {
        if (volume < 0.5) {
          volume = Math.min(0.5, volume + 0.05);
          if (
            this.currentMusic &&
            typeof this.currentMusic.setVolume === "function"
          ) {
            this.currentMusic.setVolume(volume);
          }
        } else {
          clearInterval(this.fadeInterval);
        }
      }, 100);
    },

    fadeOut() {
      if (!this.currentMusic) return;

      clearInterval(this.fadeInterval);
      let volume =
        this.currentMusic && typeof this.currentMusic.volume === "function"
          ? this.currentMusic.volume()
          : 0;

      this.fadeInterval = setInterval(() => {
        if (volume > 0) {
          volume = Math.max(0, volume - 0.05);
          if (
            this.currentMusic &&
            typeof this.currentMusic.setVolume === "function"
          ) {
            this.currentMusic.setVolume(volume);
          }
        } else {
          clearInterval(this.fadeInterval);
          if (
            this.currentMusic &&
            typeof this.currentMusic.stop === "function"
          ) {
            this.currentMusic.stop();
          }
          this.currentMusic = null;
        }
      }, 50);
    },
  };

  // функция инициализации звука
  function initAudioOnUserInteraction() {
    if (!audioManager.initialized) {
      audioManager.init();

      // Разблокировка звука для iOS
      function unlockAudio() {
        Object.values(audioManager.sounds).forEach((sound) => {
          sound.play();
          sound.stop();
        });

        document.removeEventListener("touchstart", unlockAudio);
        document.removeEventListener("touchend", unlockAudio);
        document.removeEventListener("click", unlockAudio);
      }

      document.addEventListener("touchstart", unlockAudio);
      document.addEventListener("touchend", unlockAudio);
      document.addEventListener("click", unlockAudio);
    }
  }

  // ф воспроизведения звука сбора монет
  function playCollectSound() {
    audioManager.play("coin", { volume: 0.6 });
  }

  // функция воспроизведения звуков отсчета
  function playCountdownSound(count) {
    const soundMap = {
      0: "countdown3",
      1: "countdown2",
      2: "countdown1",
      3: "countdownGo",
    };
    audioManager.play(soundMap[count], { volume: 0.7 });
  }

  // обработчики кнопок
  elements.playButton.addEventListener("click", () => {
    initAudioOnUserInteraction();
    startGame();
  });

  elements.playAgainButton.addEventListener("click", () => {
    initAudioOnUserInteraction();
    resetGame();
  });

  // Обновляем функцию проигрывания звуков смерти
  function playDeathSoundMultipleTimes(times = 3) {
    let playCount = 0;

    function playNextSound() {
      if (playCount < times) {
        audioManager.play("death", { volume: 1.0 });
        playCount++;
        setTimeout(playNextSound, 300);
      } else if (playCount === times) {
        setTimeout(() => {
          audioManager.play("deathFinal", { volume: 1.0 });
        }, 300);
      }
    }

    playNextSound();
  }

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

    document.body.appendChild(overlay);
    document.body.appendChild(container);

    return { container, overlay };
  }

  // Настройка контейнера отсчёта
  function setupCountdownContainer(container) {
    container.classList.add("countdown-container");
  }

  // Настройка оверлея отсчёта
  function setupCountdownOverlay(overlay) {
    overlay.classList.add("countdown-overlay");
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
    elements.menuContainer.classList.add("hidden");
    elements.gameContainer.style.display = "block";

    // Сначала убираем экран Game Over
    elements.gameOverScreen.classList.add("hiding");
    setTimeout(() => {
      elements.gameOverScreen.style.display = "none";
      elements.gameOverScreen.classList.remove("hiding");
      elements.gameOverScreen.classList.remove("visible");
    }, 1000);
    cosmonautsCollected = 0;
    elements.cosmonautCounter.textContent = "0";
    const counter = document.getElementById("cosmonaut-counter");
    counter.style.display = "block";

    playCountdown(() => {
      initializeGameSession();
      counter.classList.add("visible");
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
    musicController.playBackground();

    clearAllIntervals();
    startGameLoops();
    isGameStarting = false; // Сбрасываем флаг после полного запуска игры
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
    if (musicController.currentMusic?.source) {
      musicController.currentMusic.source.stop();
    }

    // Очищаем все изображения взрывов
    const explosionImages = elements.gameContainer.querySelectorAll("img");
    explosionImages.forEach((img) => img.remove());

    // Скрываем экран Game Over с анимацией
    elements.gameOverScreen.classList.add("hiding");
    setTimeout(() => {
      elements.gameOverScreen.style.display = "none";
      elements.gameOverScreen.classList.remove("hiding");
      elements.gameOverScreen.classList.remove("visible");

      // Сразу запускаем отсчет
      startGame();
    }, 1000);
    elements.player.style.display = "block";
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
        cosmonautsCollected++;
        elements.cosmonautCounter.textContent = cosmonautsCollected;
        object.remove();
        // Воспроизводим звук монеты при сборе космонавта
        playCollectSound();
      }
    }
  }

  // Завершение игры
  function endGame() {
    clearAllIntervals();
    musicController.fadeOut();
    const counter = document.getElementById("cosmonaut-counter");
    counter.classList.add("death-animation");
    playDeathAnimation();
  }

  // Показ экрана Game Over
  function showGameOverScreen() {
    const counter = document.getElementById("cosmonaut-counter");
    counter.classList.remove("death-animation");
    counter.style.display = "none";

    elements.gameOverScreen.style.display = "flex";
    elements.gameOverScreen.classList.remove("hiding");

    // Даем время браузеру обработать display: flex
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        elements.gameOverScreen.classList.add("visible");
        elements.finalScoreDisplay.textContent = score;
        if (score > highScore) {
          highScore = score;
          localStorage.setItem("highScore", highScore);
          elements.highScoreDisplay.textContent = highScore;
        }
      });
    });
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
        setTimeout(() => {
          explosionContainer.remove();
          showGameOverScreen();
        }, 300);
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

      setTimeout(() => {
        requestAnimationFrame(animate);
      }, 300);
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

  // Настройка управления
  function setupControls() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        playerSettings.movingLeft = true;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        playerSettings.movingRight = true;
      }
    });

    document.addEventListener("keyup", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        playerSettings.movingLeft = false;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        playerSettings.movingRight = false;
      }
    });

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

  // Убедимся, что игра начинается только после загрузки всех ресурсов
  const loadingScreen = document.getElementById("loading-screen");
  const menuContainer = document.getElementById("menu-container");

  if (loadingScreen.style.display === "none") {
    setupControls();
  } else {
    const observer = new MutationObserver(() => {
      if (loadingScreen.style.display === "none") {
        setupControls();
        observer.disconnect();
      }
    });

    observer.observe(loadingScreen, {
      attributes: true,
      attributeFilter: ["style"],
    });
  }
});
