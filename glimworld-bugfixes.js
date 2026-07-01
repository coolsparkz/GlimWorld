// ============================================================
// GLIMWORLD BUG FIXES
// ============================================================

// FIX #1: Improved disposeScene function
function disposeScene(scene, renderer) {
  scene.traverse(o => {
    if (o.isMesh) {
      o.geometry.dispose();
      if (Array.isArray(o.material)) {
        o.material.forEach(m => m.dispose());
      } else {
        o.material.dispose();
      }
    }
  });
  renderer.dispose();
  if (renderer.domElement.parentNode) {
    renderer.domElement.remove(); // ✅ NEW: Remove from DOM
  }
}

// FIX #2: Pizza Rush - Proper position clamping
// BEFORE:
// player.position.clampScalar(-35, 35);

// AFTER:
function clampPlayerPositionPizzaRush(player) {
  player.position.x = Math.max(-35, Math.min(35, player.position.x));
  player.position.z = Math.max(-45, Math.min(45, player.position.z));
}

// FIX #3: Add trail disposal to games missing it
// For: runObbyTower, runParkourCity, runPizzaRush, runSpeedRacing, 
//      runTowerDefense, runSpaceBlaster

// Replace cleanup functions. Example for runObbyTower:
// OLD:
// return()=>{running=false;cancelAnimationFrame(animId);detach();
//   window.removeEventListener('resize',onResize);disposeScene(scene,renderer);};

// NEW:
return () => {
  running = false;
  cancelAnimationFrame(animId);
  detach();
  window.removeEventListener('resize', onResize);
  trail.dispose(); // ✅ NEW: If trail exists
  disposeScene(scene, renderer);
};

// FIX #4: Fix Bubble Pop duplicate render
// BEFORE (lines ~4550):
// camera.lookAt(player.position);
// renderer.render(scene, camera);
// camera.lookAt(player.position);  // ❌ DUPLICATE
// renderer.render(scene, camera);   // ❌ DUPLICATE

// AFTER: Keep only one set
function runBubblePop_FIXED(container, onScore, onComplete) {
  // ... all game code ...
  
  function animate() {
    if (!running) return;
    animId = requestAnimationFrame(animate);
    
    // ... all update code ...
    
    // ✅ FIXED: Only render once
    camera.position.lerp(player.position.clone().add(new THREE.Vector3(0, 9, 13)), .09);
    camera.lookAt(player.position);
    renderer.render(scene, camera);
    // Removed duplicate camera.lookAt and renderer.render
  }
}

// FIX #5: Better localStorage error handling
const store = (function() {
  function load() {
    try {
      const raw = {
        coins: parseInt(localStorage.getItem('gw_coins') || '0', 10),
        currentChar: localStorage.getItem('gw_char') || 'purple',
        ownedChars: JSON.parse(localStorage.getItem('gw_owned') || '["purple"]'),
        currentTrail: localStorage.getItem('gw_trail') || 'none',
        ownedTrails: JSON.parse(localStorage.getItem('gw_trails') || '["none"]'),
      };
      
      // ✅ NEW: Validate data
      if (!raw.ownedChars.includes(raw.currentChar)) {
        raw.currentChar = 'purple';
      }
      if (!raw.ownedTrails.includes(raw.currentTrail)) {
        raw.currentTrail = 'none';
      }
      
      return raw;
    } catch (e) {
      console.error('Storage load error:', e);
      return {
        coins: 0,
        currentChar: 'purple',
        ownedChars: ['purple'],
        currentTrail: 'none',
        ownedTrails: ['none'],
      };
    }
  }
  
  const s = load();
  return {
    get coins() { return s.coins; },
    get currentChar() { return s.currentChar; },
    get ownedChars() { return s.ownedChars; },
    get currentTrail() { return s.currentTrail; },
    get ownedTrails() { return s.ownedTrails; },
    addCoins(n) {
      s.coins = Math.max(0, s.coins + n); // ✅ Prevent negative coins
      localStorage.setItem('gw_coins', s.coins);
    },
    equipChar(id) {
      if (CHARS.find(c => c.id === id)) { // ✅ Validate
        s.currentChar = id;
        localStorage.setItem('gw_char', id);
      }
    },
    equipTrail(id) {
      if (TRAILS.find(t => t.id === id)) { // ✅ Validate
        s.currentTrail = id;
        localStorage.setItem('gw_trail', id);
      }
    },
    buyChar(id, cost) {
      if (s.ownedChars.includes(id)) {
        this.equipChar(id);
        return 'equipped';
      }
      if (s.coins < cost) return 'no_funds';
      s.coins -= cost;
      s.ownedChars.push(id);
      localStorage.setItem('gw_coins', s.coins);
      localStorage.setItem('gw_owned', JSON.stringify(s.ownedChars));
      this.equipChar(id);
      return 'bought';
    },
    buyTrail(id, cost) {
      if (s.ownedTrails.includes(id)) {
        this.equipTrail(id);
        return 'equipped';
      }
      if (s.coins < cost) return 'no_funds';
      s.coins -= cost;
      s.ownedTrails.push(id);
      localStorage.setItem('gw_coins', s.coins);
      localStorage.setItem('gw_trails', JSON.stringify(s.ownedTrails));
      this.equipTrail(id);
      return 'bought';
    },
  };
})();

// FIX #6: Improve search filter
function filterGames() {
  const v = document.getElementById('search-input').value.trim().toLowerCase();
  document.getElementById('search-clear').style.display = v ? 'block' : 'none';
  renderGames();
}

// FIX #7: Prevent game-over animation stutter
function showGameOver(msg) {
  const box = document.getElementById('game-over-box');
  box.classList.remove('slide-up'); // ✅ Remove first to retrigger animation
  box.textContent = msg;
  document.getElementById('game-over-msg').textContent = msg;
  document.getElementById('game-over-overlay').style.display = 'flex';
  // Force reflow to restart animation
  void box.offsetWidth;
  box.classList.add('slide-up');
}

// FIX #8: Handle window resize cleanup properly
function launchGame(id) {
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }
  activeGameId = id;
  showScreen('game');
  document.getElementById('game-hud').textContent = '…';
  document.getElementById('controls-hint').textContent = CONTROLS[id] || '';
  document.getElementById('game-over-overlay').style.display = 'none';
  const container = document.getElementById('game-canvas-wrap');
  container.innerHTML = '';
  
  const fn = GAME_FNS[id];
  if (!fn) {
    document.getElementById('game-hud').textContent = 'Game not found!';
    return;
  }
  
  cleanupFn = fn(container, s => {
    document.getElementById('game-hud').textContent = s;
  }, (msg) => {
    refreshCoins();
    showGameOver(msg);
  });
  
  document.getElementById('replay-btn').onclick = () => launchGame(id);
}

// FIX #9: Prevent multiple animations on shop tab
let lastTabSwitch = 0;
function setShopTab(t) {
  const now = Date.now();
  if (now - lastTabSwitch < 100) return; // ✅ Debounce
  lastTabSwitch = now;
  
  shopTab = t;
  document.getElementById('tab-chars').classList.toggle('active', t === 'chars');
  document.getElementById('tab-trails').classList.toggle('active', t === 'trails');
  renderShop();
}
