document.addEventListener("DOMContentLoaded", () => {
  const gameContainer = document.getElementById("game-container");
  const player = document.getElementById("player");
  const menuContainer = document.getElementById("menu-container");
  const playButton = document.getElementById("play-button");
  const gameOverScreen = document.getElementById("game-over-screen");
  const finalScoreDisplay = document.getElementById("final-score");
  const highScoreDisplay = document.getElementById("high-score");
  const playAgainButton = document.getElementById("play-again-button");

  if (
    !gameContainer ||
    !player ||
    !menuContainer ||
    !playButton ||
    !gameOverScreen
  ) {
    console.error("Один из элементов игры не найден!");
    return;
  }

  let gameInterval,
    difficultyIncreaseInterval,
    obstacleSpawnTimeout,
    itemSpawnTimeout;
  let score = 0;
  let highScore = localStorage.getItem("highScore") || 0;
  highScoreDisplay.textContent = highScore;

  let obstacles = [];
  let itemsToCollect = [];

  const playerSettings = {
    speed: 5,
    x: 180,
    movingLeft: false,
    movingRight: false,
    isTouchActive: false,
    touchStartX: 0,
  };

  const gameSettings = {
    obstacleSpeed: 2,
    itemSpeed: 2,
    spawnDelayRange: { min: 500, max: 2000 },
    obstacleCreationChance: 0.2,
    itemCreationChance: 0.2,
    difficultyLevel: 1,
    maxObjects: 30,
  };

  const deathAnimationFrames = [
    "img/bomb-1.svg",
    "img/bomb-2.svg",
    "img/bomb-3.svg",
  ];

  function startGame() {
    score = 0;
    obstacles.forEach((obstacle) => obstacle.remove());
    itemsToCollect.forEach((item) => item.remove());
    obstacles = [];
    itemsToCollect = [];
    resetPlayerPosition();
    resetGameSettings();

    gameContainer.style.display = "block";
    menuContainer.style.top = "-100%";
    gameOverScreen.style.top = "100%";

    clearInterval(gameInterval);
    clearInterval(difficultyIncreaseInterval);
    clearTimeout(obstacleSpawnTimeout);
    clearTimeout(itemSpawnTimeout);

    gameInterval = setInterval(gameLoop, 20);
    difficultyIncreaseInterval = setInterval(increaseDifficulty, 10000);

    spawnObstacles();
    spawnItems();
  }

  function gameLoop() {
    updatePlayerPosition();
    moveObjects();
  }

  function resetGame() {
    clearInterval(gameInterval);
    clearInterval(difficultyIncreaseInterval);
    clearTimeout(obstacleSpawnTimeout);
    clearTimeout(itemSpawnTimeout);

    obstacles.forEach((obstacle) => obstacle.remove());
    itemsToCollect.forEach((item) => item.remove());
    obstacles = [];
    itemsToCollect = [];

    const explosionImages = gameContainer.querySelectorAll("img");
    explosionImages.forEach((img) => img.remove());

    gameOverScreen.style.display = "none";
    player.style.display = "block";
    gameContainer.style.opacity = 0;

    setTimeout(() => {
      startGame();
      gameContainer.style.opacity = 1;
    }, 500);
  }

  function updatePlayerPosition() {
    if (playerSettings.movingLeft) {
      playerSettings.x = Math.max(0, playerSettings.x - playerSettings.speed);
    }
    if (playerSettings.movingRight) {
      playerSettings.x = Math.min(
        gameContainer.offsetWidth - player.offsetWidth,
        playerSettings.x + playerSettings.speed
      );
    }
    player.style.left = `${playerSettings.x}px`;
  }

  function createObstacle() {
    if (obstacles.length >= gameSettings.maxObjects / 2) return;

    const obstacle = document.createElement("div");
    obstacle.classList.add("asteroid");
    obstacle.style.left = `${
      Math.random() * (gameContainer.offsetWidth - 40)
    }px`;
    obstacle.style.top = "-30px";
    gameContainer.appendChild(obstacle);
    obstacles.push(obstacle);
  }

  function createItem() {
    if (itemsToCollect.length >= gameSettings.maxObjects / 2) return;

    const item = document.createElement("div");
    item.classList.add("cosmonavt");
    item.style.left = `${Math.random() * (gameContainer.offsetWidth - 40)}px`;
    item.style.top = "-30px";
    gameContainer.appendChild(item);
    itemsToCollect.push(item);
  }

  function moveObjects() {
    const containerHeight = gameContainer.offsetHeight;

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

  function checkCollision(object, type) {
    const playerRect = player.getBoundingClientRect();
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
      }
    }
  }

  function endGame() {
    clearInterval(gameInterval);
    clearInterval(difficultyIncreaseInterval);
    clearTimeout(obstacleSpawnTimeout);
    clearTimeout(itemSpawnTimeout);
    playDeathAnimation();
  }

  function showGameOverScreen() {
    gameOverScreen.style.display = "flex";
    setTimeout(() => {
      gameOverScreen.style.top = "0%";
      finalScoreDisplay.textContent = score;
      if (score > highScore) {
        highScore = score;
        localStorage.setItem("highScore", highScore);
        highScoreDisplay.textContent = highScore;
      }
    }, 100);
  }

  function playDeathAnimation() {
    const playerX = player.offsetLeft;
    const playerY = player.offsetTop;
    player.style.display = "none";

    let animationFrame = 0;
    const explosionContainer = document.createElement("div");
    explosionContainer.style.position = "absolute";
    explosionContainer.style.left = `${playerX}px`;
    explosionContainer.style.top = `${playerY}px`;
    explosionContainer.style.pointerEvents = "none";

    const animate = () => {
      if (animationFrame >= deathAnimationFrames.length) {
        explosionContainer.remove();
        showGameOverScreen();
        return;
      }

      explosionContainer.innerHTML = "";
      const img = document.createElement("img");
      img.src = deathAnimationFrames[animationFrame];
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

    gameContainer.appendChild(explosionContainer);
    animate();
  }

  function resetPlayerPosition() {
    playerSettings.x = 180;
    player.style.left = "180px";
    player.style.display = "block";
  }

  function resetGameSettings() {
    gameSettings.obstacleSpeed = 2;
    gameSettings.itemSpeed = 2;
    gameSettings.spawnDelayRange = { min: 500, max: 2000 };
    gameSettings.obstacleCreationChance = 0.2;
    gameSettings.itemCreationChance = 0.2;
    gameSettings.difficultyLevel = 1;
  }

  function increaseDifficulty() {
    gameSettings.difficultyLevel++;
    gameSettings.obstacleSpeed = Math.min(8, gameSettings.obstacleSpeed + 0.5);
    gameSettings.itemSpeed = Math.min(8, gameSettings.itemSpeed + 0.5);

    gameSettings.obstacleCreationChance = Math.min(
      0.5,
      gameSettings.obstacleCreationChance + 0.05
    );
    gameSettings.itemCreationChance = Math.min(
      0.5,
      gameSettings.itemCreationChance + 0.05
    );

    gameSettings.spawnDelayRange.max = Math.max(
      500,
      gameSettings.spawnDelayRange.max - 100
    );
  }

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

  playButton.addEventListener("click", startGame);
  playAgainButton.addEventListener("click", resetGame);

  gameContainer.tabIndex = 0;
  gameContainer.focus();

  gameContainer.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") playerSettings.movingLeft = true;
    if (e.key === "ArrowRight") playerSettings.movingRight = true;
  });

  gameContainer.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") playerSettings.movingLeft = false;
    if (e.key === "ArrowRight") playerSettings.movingRight = false;
  });

  player.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      playerSettings.isTouchActive = true;
      playerSettings.touchStartX = e.touches[0].clientX;
    },
    { passive: false }
  );

  player.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      if (playerSettings.isTouchActive) {
        const touchX = e.touches[0].clientX;
        const deltaX = touchX - playerSettings.touchStartX;
        playerSettings.x += deltaX;
        playerSettings.touchStartX = touchX;
        updatePlayerPosition();
      }
    },
    { passive: false }
  );

  player.addEventListener("touchend", () => {
    playerSettings.isTouchActive = false;
  });
  player.addEventListener("touchcancel", () => {
    playerSettings.isTouchActive = false;
  });
});
