'use strict';
const MANIFEST = 'flutter-app-manifest';
const TEMP = 'flutter-temp-cache';
const CACHE_NAME = 'flutter-app-cache';

const RESOURCES = {"canvaskit/canvaskit.js": "8331fe38e66b3a898c4f37648aaf7ee2",
"canvaskit/skwasm_heavy.js": "740d43a6b8240ef9e23eed8c48840da4",
"canvaskit/skwasm_heavy.js.symbols": "0755b4fb399918388d71b59ad390b055",
"canvaskit/chromium/canvaskit.js": "a80c765aaa8af8645c9fb1aae53f9abf",
"canvaskit/chromium/canvaskit.wasm": "a726e3f75a84fcdf495a15817c63a35d",
"canvaskit/chromium/canvaskit.js.symbols": "e2d09f0e434bc118bf67dae526737d07",
"canvaskit/skwasm.js.symbols": "3a4aadf4e8141f284bd524976b1d6bdc",
"canvaskit/skwasm.js": "8060d46e9a4901ca9991edd3a26be4f0",
"canvaskit/skwasm.wasm": "7e5f3afdd3b0747a1fd4517cea239898",
"canvaskit/skwasm_heavy.wasm": "b0be7910760d205ea4e011458df6ee01",
"canvaskit/canvaskit.wasm": "9b6a7830bf26959b200594729d73538e",
"canvaskit/canvaskit.js.symbols": "a3c9f77715b642d0437d9c275caba91e",
"flutter.js": "24bc71911b75b5f8135c949e27a2984e",
"flutter_bootstrap.js": "3a2c299b6e1c3a196220a439be9edee5",
"index.html": "4b400cd079e703558777356d02d7c8ac",
"/": "4b400cd079e703558777356d02d7c8ac",
"main.dart.js": "715d6bf56c162b0e635ec0a3b975ae2e",
"version.json": "ab94d520b1da15eba30226233358e067",
"assets/assets/branding/bg-capa-premium.jpg": "6986d2d9e056f50b0c7f1e7d30befc3e",
"assets/assets/branding/google-logo.svg": "80ac0f1be23a8feaaec071761a42feca",
"assets/assets/branding/logo-rocha-prime-badge.png": "93f61f4a84cc42c257c76ee0d462949e",
"assets/assets/branding/logo-rocha-prime-blue.svg": "e90d8014ec9b800bf074e849e7c73f7f",
"assets/assets/branding/logo-rocha-prime-horizontal.png": "01554f0f21fc5d4df48befc384774493",
"assets/assets/branding/logo-rocha-prime-institucional.svg": "9b558352e3bb32cf837f8864aa1f3986",
"assets/assets/branding/logo-rocha-prime-white.svg": "246b5b89b728951f9fb6ff9aaa13b923",
"assets/assets/branding/logo-rocha-prime.png": "3737516cbf286cbb08e8eb51c6823e7c",
"assets/assets/branding/microsoft-logo.svg": "ff26caf76cad9288ee0d6249148cc7be",
"assets/assets/branding/prime-icon-extracted.png": "9c3ce87722e43c08137ac060922f3868",
"assets/assets/branding/prime-icon.png": "8a976d0a49666f039d81345d2568eafd",
"assets/assets/branding/prime-icon.svg": "f7e1fe373dc3c3c2e25d5295b5382c27",
"assets/assets/branding/sync-logo.svg": "ffb876f784ecb84b582b19cab7f38de0",
"assets/assets/branding/sync-mark.svg": "fb4bb951d7b5d5e955d34f676dc34e4e",
"assets/assets/censo_matriculas.json": "77973974833cdea6b0aa1f85c6822d50",
"assets/assets/fonts/InterVariable.ttf": "bff0f6e3b9e2259a28313168a907054f",
"assets/assets/ideb_historico.json": "f707c1f6cdb89a2ca535f12111a99252",
"assets/packages/lucide_icons_flutter/assets/build_font/LucideVariable-w200.ttf": "3604dfafd2e1e2f6d6d0bca8bc06d0ab",
"assets/packages/lucide_icons_flutter/assets/build_font/LucideVariable-w100.ttf": "491075e6c192635ee24bf2ef49b090b3",
"assets/packages/lucide_icons_flutter/assets/build_font/LucideVariable-w400.ttf": "5d7db6ef7b1231e5e6962572f69fc687",
"assets/packages/lucide_icons_flutter/assets/build_font/LucideVariable-w600.ttf": "bddca51a7b5bbbc4429a28f557250f89",
"assets/packages/lucide_icons_flutter/assets/build_font/LucideVariable-w500.ttf": "ea52da161d3ea02cc64c75a364ec68cf",
"assets/packages/lucide_icons_flutter/assets/build_font/LucideVariable-w300.ttf": "6981ba79990f5513770efa0e0a12ad2f",
"assets/packages/lucide_icons_flutter/assets/lucide.ttf": "588e99c3adbeb77a5ba0b645401ed8ee",
"assets/fonts/MaterialIcons-Regular.otf": "78dec2772fc094b4fbe1454236ed0da9",
"assets/shaders/ink_sparkle.frag": "ecc85a2e95f5e9f53123dcaf8cb9b6ce",
"assets/shaders/stretch_effect.frag": "40d68efbbf360632f614c731219e95f0",
"assets/AssetManifest.bin": "2c941df9566ea0dfa31d2e17dbad0a07",
"assets/FontManifest.json": "78a8d7f29d05f0932f71a10f08e975a0",
"assets/AssetManifest.bin.json": "05e73a3fe58382150c237b36f052ba30",
"assets/NOTICES": "818946a3a1a58227769f628dfcacd353",
"favicon.png": "3737516cbf286cbb08e8eb51c6823e7c",
"icons/Icon-192.png": "ac9a721a12bbc803b44f645561ecb1e1",
"icons/Icon-512.png": "96e752610906ba2a93c65f8abe1645f1",
"icons/Icon-maskable-192.png": "c457ef57daa1d16f64b27b786ec2ea3c",
"icons/Icon-maskable-512.png": "301a7604d45b3e739efc881eb04896ea",
"manifest.json": "40c09f47866ca44e0365ada089956862"};
// The application shell files that are downloaded before a service worker can
// start.
const CORE = ["main.dart.js",
"index.html",
"flutter_bootstrap.js",
"assets/AssetManifest.bin.json",
"assets/FontManifest.json"];

// During install, the TEMP cache is populated with the application shell files.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  return event.waitUntil(
    caches.open(TEMP).then((cache) => {
      return cache.addAll(
        CORE.map((value) => new Request(value, {'cache': 'reload'})));
    })
  );
});
// During activate, the cache is populated with the temp files downloaded in
// install. If this service worker is upgrading from one with a saved
// MANIFEST, then use this to retain unchanged resource files.
self.addEventListener("activate", function(event) {
  return event.waitUntil(async function() {
    try {
      var contentCache = await caches.open(CACHE_NAME);
      var tempCache = await caches.open(TEMP);
      var manifestCache = await caches.open(MANIFEST);
      var manifest = await manifestCache.match('manifest');
      // When there is no prior manifest, clear the entire cache.
      if (!manifest) {
        await caches.delete(CACHE_NAME);
        contentCache = await caches.open(CACHE_NAME);
        for (var request of await tempCache.keys()) {
          var response = await tempCache.match(request);
          await contentCache.put(request, response);
        }
        await caches.delete(TEMP);
        // Save the manifest to make future upgrades efficient.
        await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
        // Claim client to enable caching on first launch
        self.clients.claim();
        return;
      }
      var oldManifest = await manifest.json();
      var origin = self.location.origin;
      for (var request of await contentCache.keys()) {
        var key = request.url.substring(origin.length + 1);
        if (key == "") {
          key = "/";
        }
        // If a resource from the old manifest is not in the new cache, or if
        // the MD5 sum has changed, delete it. Otherwise the resource is left
        // in the cache and can be reused by the new service worker.
        if (!RESOURCES[key] || RESOURCES[key] != oldManifest[key]) {
          await contentCache.delete(request);
        }
      }
      // Populate the cache with the app shell TEMP files, potentially overwriting
      // cache files preserved above.
      for (var request of await tempCache.keys()) {
        var response = await tempCache.match(request);
        await contentCache.put(request, response);
      }
      await caches.delete(TEMP);
      // Save the manifest to make future upgrades efficient.
      await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
      // Claim client to enable caching on first launch
      self.clients.claim();
      return;
    } catch (err) {
      // On an unhandled exception the state of the cache cannot be guaranteed.
      console.error('Failed to upgrade service worker: ' + err);
      await caches.delete(CACHE_NAME);
      await caches.delete(TEMP);
      await caches.delete(MANIFEST);
    }
  }());
});
// The fetch handler redirects requests for RESOURCE files to the service
// worker cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  var origin = self.location.origin;
  var key = event.request.url.substring(origin.length + 1);
  // Redirect URLs to the index.html
  if (key.indexOf('?v=') != -1) {
    key = key.split('?v=')[0];
  }
  if (event.request.url == origin || event.request.url.startsWith(origin + '/#') || key == '') {
    key = '/';
  }
  // If the URL is not the RESOURCE list then return to signal that the
  // browser should take over.
  if (!RESOURCES[key]) {
    return;
  }
  // If the URL is the index.html, perform an online-first request.
  if (key == '/') {
    return onlineFirst(event);
  }
  event.respondWith(caches.open(CACHE_NAME)
    .then((cache) =>  {
      return cache.match(event.request).then((response) => {
        // Either respond with the cached resource, or perform a fetch and
        // lazily populate the cache only if the resource was successfully fetched.
        return response || fetch(event.request).then((response) => {
          if (response && Boolean(response.ok)) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
    })
  );
});
self.addEventListener('message', (event) => {
  // SkipWaiting can be used to immediately activate a waiting service worker.
  // This will also require a page refresh triggered by the main worker.
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
    return;
  }
  if (event.data === 'downloadOffline') {
    downloadOffline();
    return;
  }
});
// Download offline will check the RESOURCES for all files not in the cache
// and populate them.
async function downloadOffline() {
  var resources = [];
  var contentCache = await caches.open(CACHE_NAME);
  var currentContent = {};
  for (var request of await contentCache.keys()) {
    var key = request.url.substring(origin.length + 1);
    if (key == "") {
      key = "/";
    }
    currentContent[key] = true;
  }
  for (var resourceKey of Object.keys(RESOURCES)) {
    if (!currentContent[resourceKey]) {
      resources.push(resourceKey);
    }
  }
  return contentCache.addAll(resources);
}
// Attempt to download the resource online before falling back to
// the offline cache.
function onlineFirst(event) {
  return event.respondWith(
    fetch(event.request).then((response) => {
      return caches.open(CACHE_NAME).then((cache) => {
        cache.put(event.request, response.clone());
        return response;
      });
    }).catch((error) => {
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response != null) {
            return response;
          }
          throw error;
        });
      });
    })
  );
}
