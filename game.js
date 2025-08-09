// ─── CONFIG ───
const winScore    = 1;      // how many pipe-pairs to pass before “win”
const internalW   = 320, internalH = 480;
// ───────────────

const RAD  = Math.PI / 180;
const scrn = document.getElementById("canvas");
const sctx = scrn.getContext("2d");

/* ===========================
   MOBILE-SAFE FULLSCREEN SHIM
   =========================== */
// Try fullscreen on a target; if blocked (iOS in iframe), request parent fallback
async function _tryFullscreen(el) {
  try {
    // Standards first (returns a promise in most browsers)
    if (el.requestFullscreen) {
      const p = el.requestFullscreen();
      if (p && typeof p.catch === "function") {
        await p.catch(() => {}); // swallow; we detect below
      }
      return;
    }
    // WebKit (older iOS Safari)
    if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); return; }
    // MS legacy
    if (el.msRequestFullscreen) { el.msRequestFullscreen(); return; }
  } catch (_) {
    // ignore; we'll handle fallback
  }
}

// Detect if we actually entered fullscreen; if not, notify parent to open full-bleed page
function _ensureOrFallback() {
  const inFS =
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement;
  if (!inFS) {
    try { window.parent.postMessage({ cmd: "openFullscreenFlappy" }, "*"); } catch(e) {}
  }
}

// Public helper you can call from any button/menu
window.requestGameFullscreen = async function(targetEl) {
  const el = targetEl || (scrn && scrn.parentNode) || document.documentElement;
  await _tryFullscreen(el);
  // iOS often "fails silently"; give it a moment and verify
  setTimeout(_ensureOrFallback, 300);
};

// OPTIONAL convenience: bind to a #fullscreenBtn if it exists
window.addEventListener("DOMContentLoaded", () => {
  const fsBtn = document.getElementById("fullscreenBtn");
  if (fsBtn) {
    fsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.requestGameFullscreen((scrn && scrn.parentNode) || document.documentElement);
    });
  }
});

// OPTIONAL desktop convenience: press "F" to toggle fullscreen/fallback
window.addEventListener("keydown", (e) => {
  if (e.key === "f" || e.key === "F") {
    window.requestGameFullscreen((scrn && scrn.parentNode) || document.documentElement);
  }
});

/* === END FULLSCREEN SHIM === */

// force full-size canvas
scrn.width       = internalW;
scrn.height      = internalH;
scrn.style.width = "100%";
scrn.style.height= "100%";

scrn.tabIndex = 1;
scrn.addEventListener("click", () => {
  if (state.curr === state.getReady) {
    state.curr = state.Play; SFX.start.play();
  } else if (state.curr === state.Play) {
    bird.flap();
  } else {
    resetToReady();
  }
});
scrn.onkeydown = e => {
  if ([32,87,38].includes(e.keyCode)) {
    if (state.curr === state.getReady) {
      state.curr = state.Play; SFX.start.play();
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

const pipe = {
  top:   { sprite:new Image() },
  bot:   { sprite:new Image() },
  gap:   85,
  moved: true,
  pipes: [],
  draw() {
    this.pipes.forEach(p => {
      sctx.drawImage(this.top.sprite, p.x, p.y);
      sctx.drawImage(this.bot.sprite,
        p.x, p.y + this.top.sprite.height + this.gap);
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
          r   = (spr.width+spr.height)/4,
          p   = pipe.pipes[0],
          roof  = p.y + pipe.top.sprite.height,
          floor = roof + pipe.gap,
          w     = pipe.top.sprite.width;
    // collision
    if (this.x+r>p.x && this.x-r<p.x+w &&
       (this.y-r<=roof || this.y+r>=floor)) {
      SFX.hit.play(); return true;
    }
    // scoring + win check
    if (pipe.moved && p.x+w < this.x) {
      UI.score.curr++;
      SFX.score.play();
      console.log("🏆 score:", UI.score.curr);
      pipe.moved = false;
      if (UI.score.curr>=winScore) {
        console.log("🎉 winScore reached");
        window.parent.postMessage("flappyWin","*");
        resetToReady();
      }
    }
    return false;
  }
};

const UI = {
  getReady:{sprite:new Image()}, gameOver:{sprite:new Image()},
  tap:[{sprite:new Image()},{sprite:new Image()}],
  score:{curr:0,best:0}, frame:0,
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
