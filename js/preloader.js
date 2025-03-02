document.addEventListener("DOMContentLoaded", () => {
  const loadingScreen = document.getElementById("loading-screen");
  const menuContainer = document.getElementById("menu-container");

  const assetsToLoad = [
    "./img/bomb-1.svg",
    "./img/bomb-2.svg",
    "./img/bomb-3.svg",
    "./img/three.svg",
    "./img/two.svg",
    "./img/one.svg",
    "./img/go.svg",
    "./img/space.svg",
    "./img/asteroid.svg",
    "./img/cosmonavt.svg",
    "./img/gov.svg",
    "./img/play.svg",
    "./img/play-again.svg",
  ];

  const soundsToLoad = [
    "./sounds/sound-play.mp3",
    "./sounds/death-sound.mp3",
    "./sounds/death-sound-2.mp3",
    "./sounds/coins.mp3",
    "./sounds/go-1.mp3",
    "./sounds/go-2.mp3",
    "./sounds/go-3.mp3",
    "./sounds/go-start.mp3",
  ];

  let loadedAssets = 0;
  const totalAssets = assetsToLoad.length + soundsToLoad.length;

  function assetLoaded() {
    loadedAssets++;
    if (loadedAssets === totalAssets) {
      loadingScreen.style.display = "none";
      menuContainer.style.display = "flex";
    }
  }

  assetsToLoad.forEach((src) => {
    const img = new Image();
    img.src = src;
    img.onload = assetLoaded;
    img.onerror = assetLoaded;
  });

  soundsToLoad.forEach((src) => {
    const sound = new Howl({
      src: [src],
      preload: true,
      onload: assetLoaded,
      onloaderror: assetLoaded,
    });
  });
});
