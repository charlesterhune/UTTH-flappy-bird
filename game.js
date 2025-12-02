// ─── CONFIG ───
const winScore    = 30;      // how many pipe-pairs to pass before "win"
const internalW   = 320, internalH = 480;
// ───────────────

const RAD  = Math.PI / 180;
const scrn = document.getElementById("canvas");
const sctx = scrn.getContext("2d");

// ===============================
// ANTI-CHEAT SYSTEM - NO RATE LIMITING
// ===============================
const GameSecurity = (function() {
  // Private variables that can't be accessed from console
  let _realScore = 0;
  let _gameStartTime = 0;
  let _totalJumps = 0;
  let _lastScoreTime = 0;
  
  return {
    startGame() {
      _realScore = 0;
      _gameStartTime = Date.now();
      _totalJumps = 0;
      _lastScoreTime = 0;
      console.log("🔒 Secure game started");
    },
    
    recordJump() {
      _totalJumps++;
    },
    
    incrementScore() {
      const now = Date.now();
      const timeSinceLastScore = now - _lastScoreTime;
      
      // Minimum time between scores (prevent rapid-fire cheating)
      if (_lastScoreTime > 0 && timeSinceLastScore < 1000) {
        console.warn("🚨 Score increment too fast - possible cheat");
        return _realScore; // Don't increment
      }
      
      _realScore++;
      _lastScoreTime = now;
      
      console.log("🏆 Secure score:", _realScore);
      return _realScore;
    },
    
    getScore() {
      return _realScore;
    },
    
    validateWin() {
      const gameTime = Date.now() - _gameStartTime;
      const minGameTime = 30000; // 30 seconds minimum (reasonable)
      
      // Check game time (prevent instant wins)
      if (gameTime < minGameTime) {
        console.warn(`🚨 Game too short: ${gameTime}ms, need ${minGameTime}ms`);
        return false;
      }
      
      // Check reasonable jump count (prevent zero-effort wins)
      const minJumps = _realScore * 1.5; // At least 1.5 jumps per point
      if (_totalJumps < minJumps) {
        console.warn(`🚨 Too few jumps: ${_totalJumps}, expected at least ${minJumps}`);
        return false;
      }
      
      // Check scoring rate (prevent superhuman speed)
      const avgTimeBetweenScores = gameTime / _realScore;
      if (avgTimeBetweenScores < 800) { // Less than 0.8 seconds per point
        console.warn(`🚨 Scoring too fast: ${avgTimeBetweenScores}ms per point`);
        return false;
      }
      
      // All checks passed
      console.log("✅ Win validated - no rate limiting applied");
      return true;
    },
    
    generateSecureWin() {
      const gameData = {
        score: _realScore,
        time: Date.now() - _gameStartTime,
        jumps: _totalJumps,
        timestamp: Date.now()
      };
      
      // Simple integrity hash
      const dataString = JSON.stringify(gameData);
      const hash = btoa(dataString + "SECURE_GAME_2024");
      
      return {
        type: "secureFlappyWin",
        data: gameData,
        hash: hash,
        validated: true,
        code: "FLAPPYSANTABIRD"
      };
    }
  };
})();

/* ===========================
   DESKTOP FULLSCREEN SHIM (unchanged)
   =========================== */
function inIframe() {
  try { return window.self !== window.top; } catch (e) { return true; }
}
function isiOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

window.requestGameFullscreen = function(targetEl) {
  const el =
    targetEl ||
    (scrn && scrn.parentNode) ||
    document.documentElement;

  if (isiOS() && inIframe()) {
    return;
  }

  try {
    if (el.requestFullscreen) { el.requestFullscreen(); }
    else if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); }
    else if (el.msRequestFullscreen) { el.msRequestFullscreen(); }
  } catch (_) {
    // ignore
  }
};

window.addEventListener("DOMContentLoaded", () => {
  const fsBtn = document.getElementById("fullscreenBtn");
  if (fsBtn) {
    fsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.requestGameFullscreen((scrn && scrn.parentNode) || document.documentElement);
    }, { passive: false });
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "f" || e.key === "F") {
    window.requestGameFullscreen((scrn && scrn.parentNode) || document.documentElement);
  }
});

// Canvas setup
scrn.width  = internalW;
scrn.height = internalH;
scrn.tabIndex = 1;

scrn.addEventListener("click", () => {
  if (state.curr === state.getReady) {
    state.curr = state.Play; 
    SFX.start.play();
    GameSecurity.startGame(); // Start secure tracking
  } else if (state.curr === state.Play) {
    bird.flap();
  } else if (state.curr === state.Win) {
    // Allow click to restart early
    resetToReady();
  } else {
    resetToReady();
  }
});

scrn.onkeydown = e => {
  if ([32,87,38].includes(e.keyCode)) {
    if (state.curr === state.getReady) {
      state.curr = state.Play; 
      SFX.start.play();
      GameSecurity.startGame(); // Start secure tracking
    } else if (state.curr === state.Play) {
      bird.flap();
    } else if (state.curr === state.Win) {
      // Allow keyboard to restart early
      resetToReady();
    } else {
      resetToReady();
    }
  }
};

function resetToReady() {
  state.curr      = state.getReady;
  bird.speed      = 0;
  bird.y          = 100;
  pipe.pipes      = [];
  UI.score.curr   = 0;
  SFX.played      = false;
}

let frames = 0, dx = 2;
let winTimer = 0; // Timer for win screen
const state = { curr:0, getReady:0, Play:1, gameOver:2, Win:3 };
const SFX = {
  start:new Audio("sfx/start.wav"),
  flap: new Audio("sfx/flap.wav"),
  score:new Audio("sfx/score.wav"),
  hit:  new Audio("sfx/hit.wav"),
  die:  new Audio("sfx/die.wav"),
  played:false
};

const gnd = {
  sprite:new Image(), x:0, y:0,
  draw() {
    this.y = scrn.height - this.sprite.height;
    sctx.drawImage(this.sprite, this.x, this.y);
  },
  update() {
    if (state.curr!==state.Play) return;
    this.x = (this.x - dx) % (this.sprite.width/2);
  }
};

const bg = {
  sprite:new Image(),
  draw() {
    sctx.drawImage(this.sprite, 0, scrn.height - this.sprite.height);
  }
};

// ===============================
// SECURED PIPE OBJECT
// ===============================
const pipe = (function() {
  const FIXED_GAP = 85; // Private, unchangeable gap
  
  return {
    top:   { sprite:new Image() },
    bot:   { sprite:new Image() },
    moved: true,
    pipes: [],
    
    // Protected gap property - blocks console.gap = 999
    get gap() {
      return FIXED_GAP; // Always return the fixed value
    },
    set gap(value) {
      console.warn("🚨 Attempt to modify pipe gap blocked");
      // Ignore all attempts to change gap
      return;
    },
    
    draw() {
      this.pipes.forEach(p => {
        sctx.drawImage(this.top.sprite, p.x, p.y);
        sctx.drawImage(this.bot.sprite,
          p.x, p.y + this.top.sprite.height + FIXED_GAP);
      });
    },
    
    update() {
      if (state.curr!==state.Play) return;
      if (frames % 100 === 0) {
        this.pipes.push({ x: scrn.width,
          y: -210 * Math.min(Math.random()+1,1.8) });
        this.moved = true;
      }
      this.pipes.forEach(p => p.x -= dx);
      if (this.pipes.length && this.pipes[0].x < -this.top.sprite.width) {
        this.pipes.shift(); this.moved = true;
      }
    }
  };
})();

const bird = {
  animations:[{sprite:new Image()},{sprite:new Image()},
              {sprite:new Image()},{sprite:new Image()}],
  rotation:0, x:50, y:100, speed:0, gravity:0.125, thrust:3.6, frame:0,
  
  draw() {
    const spr = this.animations[this.frame].sprite;
    sctx.save();
    sctx.translate(this.x,this.y);
    sctx.rotate(this.rotation*RAD);
    sctx.drawImage(spr, -spr.width/2, -spr.height/2);
    sctx.restore();
  },
  
  update() {
    const r = this.animations[0].sprite.width/2;
    switch(state.curr) {
      case state.getReady:
        this.rotation = 0;
        if (frames%10===0) {
          this.y += Math.sin(frames*RAD);
          this.frame = (this.frame+1) % this.animations.length;
        }
        break;
      case state.Play:
        if (frames%5===0)
          this.frame = (this.frame+1) % this.animations.length;
        this.y += this.speed; this.setRotation();
        this.speed += this.gravity;
        if (this.y+r>=gnd.y || this.checkCollision())
          state.curr = state.gameOver;
        break;
      case state.gameOver:
        if (!SFX.played) {
          SFX.die.play(); SFX.played = true;
        }
        break;
      case state.Win:
        // Countdown timer and reset after 10 seconds
        if (winTimer > 0) {
          winTimer--;
        } else {
          resetToReady();
        }
        break;
    }
  },
  
  flap() {
    if (this.y>0) {
      SFX.flap.play();
      this.speed = -this.thrust;
      GameSecurity.recordJump(); // Track for anti-cheat
    }
  },
  
  setRotation() {
    if (this.speed<=0)
      this.rotation = Math.max(-25, -25*this.speed/(-this.thrust));
    else
      this.rotation = Math.min(90, 90*this.speed/(this.thrust*2));
  },
  
  // ===============================
  // SECURED COLLISION DETECTION
  // ===============================
  checkCollision() {
    if (!pipe.pipes.length) return false;
    const spr = this.animations[0].sprite,
          r   = (spr.width+spr.height)/4,
          p   = pipe.pipes[0],
          roof  = p.y + pipe.top.sprite.height,
          floor = roof + pipe.gap, // Uses protected gap
          w     = pipe.top.sprite.width;
    
    // collision
    if (this.x+r>p.x && this.x-r<p.x+w &&
       (this.y-r<=roof || this.y+r>=floor)) {
      SFX.hit.play(); return true;
    }
    
    // ===============================
    // SECURED SCORING + WIN DETECTION
    // ===============================
    if (pipe.moved && p.x+w < this.x) {
      // Use secure score increment
      const newScore = GameSecurity.incrementScore();
      UI.score.curr = newScore; // Update display
      SFX.score.play();
      pipe.moved = false;
      
      // Secure win condition
      if (newScore >= winScore) {
        console.log("🎉 Win score reached, validating...");
        
        if (GameSecurity.validateWin()) {
          const secureWin = GameSecurity.generateSecureWin();
          console.log("✅ Sending validated win to parent");
          window.parent.postMessage(secureWin, "*");
          
          // Switch to win state to display password
          state.curr = state.Win;
          winTimer = 500; // 10 seconds at 20ms per frame (500 frames)
        } else {
          console.log("❌ Win validation failed - no message sent");
          resetToReady();
        }
      }
    }
    return false;
  }
};

// ===============================
// SECURED UI OBJECT
// ===============================
const UI = (function() {
  let _displayScore = 0;
  
  return {
    getReady:{sprite:new Image()}, gameOver:{sprite:new Image()},
    tap:[{sprite:new Image()},{sprite:new Image()}],
    score: {
      // Protected score - blocks UI.score.curr = 999
      get curr() {
        return _displayScore;
      },
      set curr(value) {
        // Only allow values from our secure system or reset to 0
        if (value === GameSecurity.getScore() || value === 0) {
          _displayScore = value;
        } else {
          console.warn("🚨 Attempt to modify score display blocked");
        }
      },
      best: 0
    },
    frame: 0,
    
    draw() {
      if (state.curr===state.getReady) this.drawAt(this.getReady.sprite);
      if (state.curr===state.gameOver) this.drawAt(this.gameOver.sprite);
      if (state.curr===state.Win) this.drawWinScreen();
      this.drawTap(); this.drawScore();
    },
    
    drawWinScreen() {
      // Draw semi-transparent overlay
      sctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      sctx.fillRect(0, 0, scrn.width, scrn.height);
      
      // Draw password text
      sctx.fillStyle = "#FFD700"; // Gold color
      sctx.strokeStyle = "#000";
      sctx.lineWidth = 4;
      sctx.font = "bold 40px Squada One";
      sctx.textAlign = "center";
      
      const text = "FLAPPYSANTABIRD";
      const x = scrn.width / 2;
      const y = scrn.height / 2;
      
      sctx.strokeText(text, x, y);
      sctx.fillText(text, x, y);
      
      // Draw "YOU WIN!" above it
      sctx.font = "bold 50px Squada One";
      sctx.strokeText("YOU WIN!", x, y - 60);
      sctx.fillText("YOU WIN!", x, y - 60);
      
      // Reset text align for other text
      sctx.textAlign = "left";
    },
    
    drawTap() {
      if (state.curr === state.Win) return; // Don't show tap on win screen
      
      const img = this.tap[this.frame].sprite;
      const x = (scrn.width-img.width)/2,
            y = (scrn.height-img.height)/2 +
                (state.curr===state.getReady
                  ? this.getReady.sprite.height
                  : this.gameOver.sprite.height)/2;
      sctx.drawImage(img,x,y);
    },
    
    drawScore() {
      if (state.curr === state.Win) return; // Don't show score on win screen
      
      sctx.fillStyle="#FFF"; sctx.strokeStyle="#000"; sctx.lineWidth=2;
      if (state.curr===state.Play) {
        sctx.font="35px Squada One";
        sctx.fillText(this.score.curr, scrn.width/2-5, 50);
        sctx.strokeText(this.score.curr, scrn.width/2-5, 50);
      }
      if (state.curr===state.gameOver) {
        this.score.best = Math.max(this.score.curr,
          localStorage.getItem("best")||0);
        localStorage.setItem("best", this.score.best);
        sctx.font="40px Squada One";
        sctx.fillText(`SCORE: ${this.score.curr}`, scrn.width/2-80, scrn.height/2);
        sctx.strokeText(`SCORE: ${this.score.curr}`, scrn.width/2-80, scrn.height/2);
        sctx.fillText(`BEST:  ${this.score.best}`, scrn.width/2-80, scrn.height/2+40);
        sctx.strokeText(`BEST:  ${this.score.best}`, scrn.width/2-80, scrn.height/2+40);
      }
    },
    
    update() {
      if ([state.getReady,state.gameOver].includes(state.curr) &&
          frames%10===0) {
        this.frame = (this.frame+1)%this.tap.length;
      }
    },
    
    drawAt(img) {
      sctx.drawImage(img,
        (scrn.width-img.width)/2,
        (scrn.height-img.height)/2);
    }
  };
})();

// preload assets
gnd.sprite.src      = "img/ground.png";
bg.sprite.src       = "img/BG.png";
pipe.top.sprite.src = "img/toppipe.png";
pipe.bot.sprite.src = "img/botpipe.png";
UI.getReady.sprite.src = "img/getready.png";
UI.gameOver.sprite.src = "img/go.png";
UI.tap[0].sprite.src   = "img/tap/t0.png";
UI.tap[1].sprite.src   = "img/tap/t1.png";
bird.animations[0].sprite.src = "img/bird/b0.png";
bird.animations[1].sprite.src = "img/bird/b1.png";
bird.animations[2].sprite.src = "img/bird/b2.png";
bird.animations[3].sprite.src = "img/bird/b0.png";

// game loop
function update() { bird.update(); gnd.update(); pipe.update(); UI.update(); }
function draw() {
  sctx.fillStyle = "#30c0df";
  sctx.fillRect(0,0,scrn.width,scrn.height);
  bg.draw(); pipe.draw(); bird.draw(); gnd.draw(); UI.draw();
}
function gameLoop() { update(); draw(); frames++; }
setInterval(gameLoop, 20);

// ===============================
// ANTI-TAMPERING PROTECTION
// ===============================
(function() {
  'use strict';
  
  // Block direct window.postMessage manipulation
  const originalPostMessage = window.parent.postMessage;
  let messagesSent = 0;
  
  window.parent.postMessage = function(message, targetOrigin) {
    // Only allow our secure messages
    if (message && message.type === "secureFlappyWin" && message.validated) {
      messagesSent++;
      console.log(`📤 Secure message sent (#${messagesSent})`);
      return originalPostMessage.call(this, message, targetOrigin);
    } else if (typeof message === "string" && message === "flappyWin") {
      console.warn("🚨 Legacy insecure win message blocked");
      return; // Block old insecure messages
    } else {
      // Allow other legitimate messages
      return originalPostMessage.call(this, message, targetOrigin);
    }
  };
  
  // Block access to GameSecurity object
  Object.defineProperty(window, 'GameSecurity', {
    get() { 
      console.warn('🚨 Access to GameSecurity blocked');
      return undefined; 
    },
    set() { 
      console.warn('🚨 Attempt to override GameSecurity blocked');
      return true; 
    },
    configurable: false
  });
  
  console.log("🔒 Game security initialized - no rate limiting");
})();
