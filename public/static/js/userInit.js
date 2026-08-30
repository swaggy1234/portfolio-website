/**
 * Feature 1: ask for user name on every page load (session only, no localStorage).
 * Uses the single #vispromNameModal in index.html (no second overlay).
 */
(function (global) {
  'use strict';

  var LEGACY_NAME_KEYS = [
    'vispromUserName',
    'visprom_user_id_v1',
    'visprom_name_ok_v1',
    'userName',
    'username',
    'sessionUser'
  ];

  function clearLegacyUserNameStorage() {
    try {
      LEGACY_NAME_KEYS.forEach(function (key) {
        localStorage.removeItem(key);
      });
    } catch (e) {
      console.warn('[User init] could not clear legacy localStorage keys', e);
    }
  }

  function setSessionUserName(name) {
    var trimmed = String(name).trim();
    global.vispromSessionId = 'vs-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
    global.vispromUserName = trimmed;
    try {
      sessionStorage.removeItem('visprom_saved_souche_pairs_v1');
      sessionStorage.removeItem('visprom_souche_comparison_tabs_v1');
      localStorage.removeItem('visprom_saved_souche_pairs_v1');
      localStorage.removeItem('visprom_souche_comparison_tabs_v1');
    } catch (e) { /* ignore */ }
    return trimmed;
  }

  function hideAppLoader() {
    var loader = document.getElementById('appLoadingScreen');
    if (loader) loader.style.display = 'none';
  }

  function showAppLoader() {
    if (typeof global.vispromSetLoading === 'function') {
      global.vispromSetLoading(true);
      return;
    }
    var loader = document.getElementById('appLoadingScreen');
    if (loader) loader.style.display = 'flex';
  }

  function hideNameModal() {
    var modal = document.getElementById('vispromNameModal');
    if (!modal) return;
    modal.classList.remove('visprom-name-visible');
    modal.style.display = 'none';
  }

  function getOrAskUserName() {
    return new Promise(function (resolve) {
      hideAppLoader();
      hideNameModal();

      var modal = document.getElementById('vispromNameModal');
      var input = document.getElementById('vispromNameInput');
      var btn = document.getElementById('vispromNameContinue');

      if (!modal || !input || !btn) {
        console.error('[User init] #vispromNameModal not found in page');
        resolve('');
        return;
      }

      input.value = '';
      modal.classList.add('visprom-name-visible');
      modal.style.display = 'flex';
      modal.style.zIndex = '2147483647';

      function submit() {
        var name = input.value.trim();
        if (!name) {
          input.style.borderColor = '#dc2626';
          input.focus();
          return;
        }
        setSessionUserName(name);
        hideNameModal();
        resolve(name);
      }

      btn.onclick = submit;
      input.onkeydown = function (e) {
        if (e.key === 'Enter') submit();
      };
      input.oninput = function () {
        input.style.borderColor = '';
      };
      setTimeout(function () { input.focus(); }, 0);
    });
  }

  function resolveBundleSrc() {
    // Prefer the preload URL from index.html so cache-busting stays in one place.
    try {
      var preload = document.querySelector('link[rel="preload"][as="script"][href*="static/js/res.js"]');
      if (preload && preload.getAttribute) {
        var href = preload.getAttribute('href');
        if (href) return href;
      }
    } catch (e) { /* ignore */ }
    // Fallback when preload link is missing.
    return 'static/js/res.js?v=selection-workflow-v151';
  }

  function loadAppBundle() {
    if (global.__vispromBundleLoading) return;
    global.__vispromBundleLoading = true;

    var src = global.VISPROM_APP_SCRIPT || resolveBundleSrc();
    var script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = function () {
      if (typeof global.startVispromApplication === 'function') {
        global.startVispromApplication();
      } else {
        console.error('[User init] startVispromApplication missing from bundle');
        alert('VisProm failed to start. Rebuild: cd public/js && npx browserify tool.js -o res.js');
      }
    };
    script.onerror = function () {
      global.__vispromBundleLoading = false;
      alert(
        'Could not load VisProm (res.js). Rebuild: cd public/js && npx browserify tool.js -o res.js'
      );
      hideAppLoader();
    };
    document.body.appendChild(script);
  }

  function onDomReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function bootVisProm() {
    onDomReady(function () {
      global.__vispromUserInitBoot = true;
      clearLegacyUserNameStorage();

      getOrAskUserName().then(function (name) {
        if (!name) return;
        showAppLoader();
        loadAppBundle();
      });
    });
  }

  global.getOrAskUserName = getOrAskUserName;
  global.vispromClearUserAndReload = function () {
    delete global.vispromUserName;
    global.location.reload();
  };

  bootVisProm();
})(window);
