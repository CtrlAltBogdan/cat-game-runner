const CACHE_NAME = "game-cache-v1";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
const CACHE_ENABLED = false; // Включение/отключение кеширования

const assetsToCache = [
  // Звуки
  "../sounds/sound-play.mp3",
  "../sounds/death-sound.mp3",
  "../sounds/death-sound-2.mp3",
  "../sounds/coins.mp3",
  "../sounds/go-1.mp3",
  "../sounds/go-2.mp3",
  "../sounds/go-3.mp3",
  "../sounds/go-start.mp3",
  // Изображения
  "../img/bomb-1.svg",
  "../img/bomb-2.svg",
  "../img/bomb-3.svg",
  "../img/three.svg",
  "../img/two.svg",
  "../img/one.svg",
  "../img/go.svg",
  "../img/space.svg",
  "../img/asteroid.svg",
  "../img/cosmonavt.svg",
  "../img/gov.svg",
  "../img/play.svg",
  "../img/play-again.svg",
];

self.addEventListener("install", (event) => {
  if (!CACHE_ENABLED) {
    return;
  }

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(assetsToCache))
  );
});

self.addEventListener("fetch", (event) => {
  if (!CACHE_ENABLED) {
    return event.respondWith(fetch(event.request));
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Проверяем возраст кеша
        const cachedTime = new Date(
          cachedResponse.headers.get("date")
        ).getTime();
        if (Date.now() - cachedTime < CACHE_DURATION) {
          return cachedResponse;
        }
      }
      // Если кеш устарел или отсутствует, делаем новый запрос
      return fetch(event.request).then((response) => {
        // Кешируем новый ответ
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    })
  );
});
