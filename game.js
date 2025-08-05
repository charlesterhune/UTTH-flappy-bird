// ─── CONFIG ───  
const winScore    = 1;        // how many pipe-pairs to pass before “win”  
const internalW   = 320, internalH = 480;  
// ───────────────

const RAD  = Math.PI / 180;
const scrn = document.getElementById("canvas");
const sctx = scrn.getContext("2d");

// ── FORCE FULL-SIZE CANVAS ──
scrn.width       = internalW;
scrn.height      = internalH;
scrn.style.width = "100%";
scrn.style.height= "100%";
// ────────────────────────────

scrn.tabIndex = 1;
scrn.addEventListener("click", () => {
  switch (state.curr) {
    case state.getReady:
      state.curr = state.Play;
      SFX.start.play();
      break;
    case state.Play:
      bird.flap();
      break;
    case state.gameOver:
      resetToReady();
      break;
  }
});

scrn.onkeydown = e => {
  if ([32, 87, 38].includes(e.keyCode)) {
    switch (state.curr) {
      case state.getReady:
        state.curr = state.Play;
        SFX.start.play();
        break;
      case state.Play:
        bird.flap();
        break;
      case state.gameOver:
        resetToReady();
        break;
    }
  }
};

function resetToReady() {
  state.curr     = state.getReady;
  bird.speed     = 0;
  bird.y         = 100;
  pipe.pipes     = [];
  UI.score.curr  = 0;
  SFX.played     = false;
}

let frames = 0;
let dx     = 2;

const state = { curr:0, getReady:0, Play:1, gameOver:2 };

const SFX = {
  start:  new Audio("sfx/start.wav"),
  flap:   new Audio("sfx/flap.wav"),
  score:  new Audio("sfx/score.wav"),
  hit:    new Audio("sfx/hit.wav"),
  die:    new Audio("sfx/die.wav"),
  played: false
};

const gnd = {
  sprite: new Image(), x:0, y:0,
  draw() {
    this.y = scrn.height - this.sprite.height;
    sctx.drawImage(this.sprite, this.x, this.y);
  },
  update() {
    if (state.curr !== state.Play) return;
    this.x = (this.x - dx) % (this.sprite.width / 2);
  }
};

const bg = {
  sprite: new Image(),
  draw() {
    sctx.drawImage(this.sprite, 0, scrn.height - this.sprite.height);
  }
};

const pipe = {
  top:   { sprite: new Image() },
  bot:   { sprite: new Image() },
  gap:   85,
  moved: true,
  pipes: [],
  draw() {
    this.pipes.forEach(p => {
      sctx.drawImage(this.top.sprite, p.x, p.y);
      sctx.drawImage(
        this.bot.sprite,
        p.x,
        p.y + this.top.sprite.height + this.gap
      );
    });
  },
  update() {
    if (state.curr !== state.Play) return;
    if (frames % 100 === 0) {
      this.pipes.push({
        x: scrn.width,
        y: -210 * Math.min(Math.random() + 1, 1.8)
      });
      this.moved = true;
    }
    this.pipes.forEach(p => { p.x -= dx; });
    if (this.pipes.length && this.pipes[0].x < -this.top.sprite.width) {
      this.pipes.shift();
      this.moved = true;
    }
  }
};

const bird = {
  animations: [
    { sprite:new Image() },
    { sprite:new Image() },
    { sprite:new Image() },
    { sprite:new Image() }
  ],
  rotatation: 0,
  x:50, y:100,
  speed:0,
  gravity:0.125,
  thrust:3.6,
  frame:0,

  draw() {
    const spr = this.animations[this.frame].sprite;
    sctx.save();
    sctx.translate(this.x, this.y);
    sctx.rotate(this.rotatation * RAD);
    sctx.drawImage(spr, -spr.width/2, -spr.height/2);
    sctx.restore();
  },

  update() {
    const r = this.animations[0].sprite.width / 2;
    switch (state.curr) {
      case state.getReady:
        this.rotatation = 0;
        if (frames % 10 === 0) {
          this.y += Math.sin(frames * RAD);
          this.frame = (this.frame + 1) % this.animations.length;
        }
        break;

      case state.Play:
        this.frame += frames % 5 === 0 ? 1 : 0;
        this.y    += this.speed;
        this.setRotation();
        this.speed += this.gravity;

        if (this.y + r >= gnd.y || this.checkCollision()) {
          state.curr = state.gameOver;
        }
        break;

      case state.gameOver:
        this.frame = 1;
        if (this.y + r < gnd.y) {
          this.y     += this.speed;
          this.setRotation();
          this.speed += this.gravity * 2;
        } else if (!SFX.played) {
          SFX.die.play();
          SFX.played = true;
        }
        break;
    }
    this.frame = this.frame % this.animations.length;
  },

  flap() {
    if (this.y > 0) {
      SFX.flap.play();
      this.speed = -this.thrust;
    }
  },

  setRotation() {
    if (this.speed <= 0) {
      this.rotatation = Math.max(-25, (-25 * this.speed) / (-1 * this.thrust));
    } else {
      this.rotatation = Math.min(90, (90 * this.speed) / (this.thrust * 2));
    }
  },

  checkCollision() {
    if (!pipe.pipes.length) return;
    const spr = this.animations[0].sprite;
    const x   = pipe.pipes[0].x;
    const y   = pipe.pipes[0].y;
    const r   = spr.height / 4 + spr.width / 4;
    const roof  = y + pipe.top.sprite.height;
    const floor = roof + pipe.gap;
    const w     = pipe.top.sprite.width;

    if (this.x + r >= x && this.x - r < x + w) {
      if (this.y - r <= roof || this.y + r >= floor) {
        SFX.hit.play();
        return true;
      }
    } else if (pipe.moved && x + w < this.x) {
      UI.score.curr++;
      SFX.score.play();
      pipe.moved = false;

      // ── WIN CHECK ──
      if (UI.score.curr >= winScore) {
        window.parent.postMessage("flappyWin","*");
        resetToReady();
      }
    }
  }
};

const UI = {
  getReady: { sprite:new Image() },
  gameOver:{ sprite:new Image() },
  tap:      [{ sprite:new Image() },{ sprite:new Image() }],
  score:    { curr:0, best:0 },
  frame:    0,

  draw() {
    switch (state.curr) {
      case state.getReady:
        this.drawCentered(this.getReady.sprite);
        this.drawAt(this.tap[this.frame].sprite,
          scrn.width/2 - this.tap[0].sprite.width/2,
          scrn.height/2 + this.getReady.sprite.height/2);
        break;

      case state.gameOver:
        this.drawCentered(this.gameOver.sprite);
        this.drawAt(this.tap[this.frame].sprite,
          scrn.width/2 - this.tap[0].sprite.width/2,
          scrn.height/2 + this.gameOver.sprite.height/2);
        break;
    }
    this.drawScore();
  },

  drawScore() {
    sctx.fillStyle   = "#FFFFFF";
    sctx.strokeStyle = "#000000";
    sctx.lineWidth   = 2;

    if (state.curr === state.Play) {
      sctx.font = "35px Squada One";
      sctx.fillText(this.score.curr, scrn.width/2 - 5, 50);
      sctx.strokeText(this.score.curr, scrn.width/2 - 5, 50);
    }

    if (state.curr === state.gameOver) {
      this.score.best = Math.max(this.score.curr, localStorage.getItem("best")||0);
      localStorage.setItem("best", this.score.best);
      sctx.font = "40px Squada One";
      let sc = `SCORE :     ${this.score.curr}`;
      let bs = `BEST  :     ${this.score.best}`;
      sctx.fillText(sc, scrn.width/2 - 80, scrn.height/2 + 0);
      sctx.strokeText(sc, scrn.width/2 - 80, scrn.height/2 + 0);
      sctx.fillText(bs, scrn.width/2 - 80, scrn.height/2 + 30);
      sctx.strokeText(bs, scrn.width/2 - 80, scrn.height/2 + 30);
    }
  },

  update() {
    if (state.curr === state.Play) return;
    if (frames % 10 === 0) {
      this.frame = (this.frame + 1) % this.tap.length;
    }
  },

  drawCentered(img) {
    sctx.drawImage(
      img,
      (scrn.width - img.width)/2,
      (scrn.height - img.height)/2
    );
  },

  drawAt(img, x, y) {
    sctx.drawImage(img, x, y);
  }
};

// ─── PRELOAD ASSETS ───
gnd.sprite.src          = "img/ground.png";
bg.sprite.src           = "img/BG.png";
pipe.top.sprite.src     = "img/toppipe.png";
pipe.bot.sprite.src     = "img/botpipe.png";
UI.gameOver.sprite.src  = "img/go.png";
UI.getReady.sprite.src  = "img/getready.png";
UI.tap[0].sprite.src    = "img/tap/t0.png";
UI.tap[1].sprite.src    = "img/tap/t1.png";
bird.animations[0].sprite.src = "img/bird/b0.png";
bird.animations[1].sprite.src = "img/bird/b1.png";
bird.animations[2].sprite.src = "img/bird/b2.png";
bird.animations[3].sprite.src = "img/bird/b0.png";
// SFX already wired above

// ─── GAME LOOP ───
function update() {
  bird.update();
  gnd.update();
  pipe.update();
  UI.update();
}

function draw() {
  sctx.fillStyle = "#30c0df";
  sctx.fillRect(0, 0, scrn.width, scrn.height);
  bg.draw();
  pipe.draw();
  bird.draw();
  gnd.draw();
  UI.draw();
}

function gameLoop() {
  update();
  draw();
  frames++;
}

setInterval(gameLoop, 20);
