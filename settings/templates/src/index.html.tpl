<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <title>빠띠</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="format-detection" content="telephone=no">
  <meta name="msapplication-tap-highlight" content="no">

  <link rel="icon" type="image/x-icon" href="assets/icon/favicon.ico">
  <link rel="manifest" href="manifest.json">
  <meta name="theme-color" content="#4e8ef7">
  <% if (useProxy) { %>
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' https: http: ws: data:; style-src 'self' 'unsafe-inline'; script-src 'self' http: https: 'unsafe-inline' 'unsafe-eval'">
  <% } else { %>
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' https: http: data:; style-src 'self' 'unsafe-inline'; script-src 'self' https: 'unsafe-inline' 'unsafe-eval' http:">
  <% } %>
  <!-- un-comment this code to enable service worker
  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js')
        .then(() => console.log('service worker installed'))
        .catch(err => console.log('Error', err));
    }
  </script>-->

  <link href="build/main.css" rel="stylesheet">
  <script src="assets/js/web-animations.min.js"></script>
  <script>
    document.onclick = function (e) {
      e = e ||  window.event;
      var element = e.target || e.srcElement;

      if (element.tagName == 'A' && !!element.href) {
        return false;
      }
    }
  </script>
</head>
<body>

  <!-- Ionic's root component and where the app will load -->
  <ion-app></ion-app>

  <!-- cordova.js required for cordova apps -->
  <script src="cordova.js"></script>

  <!-- The polyfills js is generated during the build process -->
  <script src="build/polyfills.js"></script>

  <!-- The bundle js is generated during the build process -->
  <script src="build/main.js"></script>

</body>
</html>
