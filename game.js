const winScore    = 100;
const internalW   = 320, internalH = 480;

const RAD  = Math.PI / 180;
const scrn = document.getElementById("canvas");
const sctx = scrn.getContext("2d");

const GameSecurity = (function() {
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
    },
    
    recordJump() {
      _totalJumps++;
    },
    
    incrementScore() {
      const now = Date.now();
      const timeSinceLastScore = now - _lastScoreTime;
      
      if (_lastScoreTime > 0 && timeSinceLastScore < 1000) {
        return _realScore;
      }
      
      _realScore++;
      _lastScoreTime = now;
      
      return _realScore;
    },
    
    getScore() {
      return _realScore;
    },
    
    validateWin() {
      const gameTime = Date.now() - _gameStartTime;
      const minGameTime = 30000;
      
      if (gameTime < minGameTime) {
        return false;
      }
      
      const minJumps = _realScore * 1.5;
      if (_totalJumps < minJumps) {
        return false;
      }
      
      const avgTimeBetweenScores = gameTime / _realScore;
      if (avgTimeBetweenScores < 800) {
        return false;
      }
      
      return true;
    },
    
    generateSecureWin() {
      const gameData = {
        score: _realScore,
        time: Date.now() - _gameStartTime,
        jumps: _totalJumps,
        timestamp: Date.now()
      };
      
      const dataString = JSON.stringify(gameData);
      const hash = btoa(dataString + "SECURE_GAME_2024");
      
      const parts = [70,76,65,80,80,89,83,65,78,84,65,66,73,82,68];
      const code = String.fromCharCode(...parts);
      
      return {
        type: "secureFlappyWin",
        data: gameData,
        hash: hash,
        validated: true,
        code: code
      };
    }
  };
})();

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

scrn.width  = internalW;
scrn.height = internalH;
scrn.tabIndex = 1;

scrn.addEventListener("click", () => {
  if (state.curr === state.getReady) {
    state.curr = state.Play; 
    SFX.start.play();
    GameSecurity.startGame();
  } else if (state.curr === state.Play) {
    bird.flap();
  } else {
    resetToReady();
  }
});

scrn.onkeydown = e => {
  if ([32,87,38].includes(e.keyCode)) {
    if (state.curr === state.getReady) {
      state.curr = state.Play; 
      SFX.start.play();
      GameSecurity.startGame();
    } else if (state.curr === state.Play) {
      bird.flap();
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
let showPasswordTimer = 0;
const state = { curr:0, getReady:0, Play:1, gameOver:2 };
const SFX = {
  start:new Audio("sfx/start.wav"),
  flap: new Audio("sfx/flap.wav"),
  score:new Audio("sfx/score.wav"),
  hit:  new Audio("sfx/hit.wav"),
  die:  new Audio("sfx/die.wav"),
  played:false
};

const gnd = {
  sprite1:new Image(), sprite2:new Image(), x:0, y:0,
  draw() {
    this.y = scrn.height - this.sprite1.height;
    const numTiles = Math.ceil(scrn.width / this.sprite1.width) + 1;
    for (let i = 0; i < numTiles; i++) {
      const sprite = (i % 2 === 0) ? this.sprite1 : this.sprite2;
      sctx.drawImage(sprite, this.x + (i * this.sprite1.width), this.y);
    }
  },
  update() {
    if (state.curr!==state.Play) return;
    this.x -= dx;
    if (this.x <= -this.sprite1.width) {
      this.x = 0;
    }
  }
};

const bg = {
  sprite:new Image(),
  draw() {
    const y = scrn.height - this.sprite.height;
    const numTiles = Math.ceil(scrn.width / this.sprite.width) + 1;
    for (let i = 0; i < numTiles; i++) {
      sctx.drawImage(this.sprite, i * this.sprite.width, y);
    }
  }
};

const pipe = (function() {
  const FIXED_GAP = 85;
  
  return {
    top:   { sprite:new Image() },
    bot:   { sprite:new Image() },
    moved: true,
    pipes: [],
    
    get gap() {
      return FIXED_GAP;
    },
    set gap(value) {
      console.warn("🚨 Attempt to modify pipe gap blocked");
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
    }
  },
  
  flap() {
    if (this.y>0) {
      SFX.flap.play();
      this.speed = -this.thrust;
      GameSecurity.recordJump();
    }
  },
  
  setRotation() {
    if (this.speed<=0)
      this.rotation = Math.max(-25, -25*this.speed/(-this.thrust));
    else
      this.rotation = Math.min(90, 90*this.speed/(this.thrust*2));
  },
  
  checkCollision() {
    if (!pipe.pipes.length) return false;
    const spr = this.animations[0].sprite,
          r   = spr.width/2.5,
          p   = pipe.pipes[0],
          roof  = p.y + pipe.top.sprite.height,
          floor = roof + pipe.gap,
          w     = pipe.top.sprite.width;
    
    if (this.x+r>p.x && this.x-r<p.x+w &&
       (this.y-r<=roof || this.y+r>=floor)) {
      SFX.hit.play(); return true;
    }
    
    if (pipe.moved && p.x+w < this.x) {
      const newScore = GameSecurity.incrementScore();
      UI.score.curr = newScore;
      SFX.score.play();
      pipe.moved = false;
      
      if (newScore >= winScore) {
        if (GameSecurity.validateWin()) {
          const secureWin = GameSecurity.generateSecureWin();
          window.parent.postMessage(secureWin, "*");
          
          showPasswordTimer = 500;
          resetToReady();
        } else {
          resetToReady();
        }
      }
    }
    return false;
  }
};

const UI = (function() {
  let _displayScore = 0;
  
  return {
    getReady:{sprite:new Image()}, gameOver:{sprite:new Image()},
    tap:[{sprite:new Image()},{sprite:new Image()}],
    score: {
      get curr() {
        return _displayScore;
      },
      set curr(value) {
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
      this.drawTap(); this.drawScore();
    },
    
    drawTap() {
      const img = this.tap[this.frame].sprite;
      const x = (scrn.width-img.width)/2,
            y = (scrn.height-img.height)/2 +
                (state.curr===state.getReady
                  ? this.getReady.sprite.height
                  : this.gameOver.sprite.height)/2;
      sctx.drawImage(img,x,y);
    },
    
    drawScore() {
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

gnd.sprite1.src     = "img/ground/g00.png";
gnd.sprite2.src     = "img/ground/g11.png";
bg.sprite.src       = "img/BGW.png";
pipe.top.sprite.src = "img/toppipec.png";
pipe.bot.sprite.src = "img/botpipec.png";
UI.getReady.sprite.src = "img/getready-c.png";
UI.gameOver.sprite.src = "img/go.png";
UI.tap[0].sprite.src   = "img/tap/t0.png";
UI.tap[1].sprite.src   = "img/tap/t1.png";
bird.animations[0].sprite.src = "img/bird/s0.png";
bird.animations[1].sprite.src = "img/bird/s1.png";
bird.animations[2].sprite.src = "img/bird/s2.png";
bird.animations[3].sprite.src = "img/bird/s0.png";

function update() { 
  bird.update(); 
  gnd.update(); 
  pipe.update(); 
  UI.update(); 
  
  if (showPasswordTimer > 0) {
    showPasswordTimer--;
  }
}
function draw() {
  sctx.fillStyle = "#30c0df";
  sctx.fillRect(0,0,scrn.width,scrn.height);
  bg.draw(); pipe.draw(); bird.draw(); gnd.draw(); UI.draw();
  
  if (showPasswordTimer > 0) {
    sctx.fillStyle = "#FFD700";
    sctx.strokeStyle = "#000";
    sctx.lineWidth = 4;
    sctx.font = "bold 30px Squada One";
    sctx.textAlign = "center";
    
    const text = String.fromCharCode(70,76,65,80,80,89,83,65,78,84,65,66,73,82,68);
    const x = scrn.width / 2;
    const y = 40;
    
    sctx.strokeText(text, x, y);
    sctx.fillText(text, x, y);
    
    sctx.textAlign = "left";
  }
}
function gameLoop() { update(); draw(); frames++; }
setInterval(gameLoop, 20);

(function() {
  'use strict';
  
  const originalPostMessage = window.parent.postMessage;
  let messagesSent = 0;
  
  window.parent.postMessage = function(message, targetOrigin) {
    if (message && message.type === "secureFlappyWin" && message.validated) {
      messagesSent++;
      return originalPostMessage.call(this, message, targetOrigin);
    } else if (typeof message === "string" && message === "flappyWin") {
      return;
    } else {
      return originalPostMessage.call(this, message, targetOrigin);
    }
  };
  
  Object.defineProperty(window, 'GameSecurity', {
    get() { 
      return undefined; 
    },
    set() { 
      return true; 
    },
    configurable: false
  });
})();
