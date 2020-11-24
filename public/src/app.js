import * as au from './asyncUtils.js';

export default class App {
  #mouseTrackingSemaphore = new au.Semaphore(1);
  #cancelPreviousCoords = null;

  //#region Drawing

  static async drawCircleAsync(x, y, r, token) {
    const stepIntervalMs = 100;
    const interval = new au.Interval();

    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.left = `${(x - r)}px`;
    canvas.style.top = `${(y - r)}px`;
    canvas.style.width = `${(r * 2)}px`;
    canvas.style.height = `${(r * 2)}px`;
    canvas.style.zIndex = -1;
  
    document.body.appendChild(canvas);
    try {
      const ctx = App.setupCanvas(canvas);
  
      const draw = (radius) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "green";
        ctx.beginPath();
        ctx.arc(r, r, radius, 0, 2 * Math.PI);
        ctx.stroke();
      };
    
      let radius = r;
      while (radius > 0) {
        draw(radius)
        await interval.delay(stepIntervalMs, token);
        await au.expectAnimationFrame(token);
        radius -= 1;
      }
    }
    finally {
      canvas.remove();
    }
  }
  
  static async drawTextAsync(x, y, s, token) {
    const initialDelayMs = 500;
    const degreesPerRotation = 3;
  
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.left = `${(x - s)}px`;
    canvas.style.top = `${(y - s)}px`;
    canvas.style.width = `${(s * 2)}px`;
    canvas.style.height = `${(s * 2)}px`;
    canvas.style.zIndex = -1;
  
    document.body.appendChild(canvas);
    try {
      const ctx = App.setupCanvas(canvas);
  
      const draw = (text, angle) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
    
        ctx.save();
        ctx.translate(s, s);
        ctx.rotate(2 * Math.PI * angle / 360);
    
        ctx.fillStyle = "blue";
        ctx.font = "bold 15px Verdana";
        ctx.textAlign="center"; 
        ctx.textBaseline = "middle";
        ctx.fillText(text, 0, 0);
        ctx.restore();
      };
    
      const text = `${x} : ${y}`;
      let angle = 0;
  
      draw(text, angle, s);
      await au.delay(initialDelayMs, token);
  
      // eslint-disable-next-line no-constant-condition
      while (true) {
        draw(text, angle, s);
        angle = (angle + degreesPerRotation) % 360;
        await au.expectAnimationFrame(token);
      }
    }
    finally {
      canvas.remove();
    }
  }

  static setupCanvas(canvas) {
    // https://www.html5rocks.com/en/tutorials/canvas/hidpi/
    const dpr = window.devicePixelRatio;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return ctx;
  }
  
  async drawMouseTrackAsync(x, y, r, token) {
    this.#cancelPreviousCoords?.();

    const coordsCts = au.createCancellationTokenSource([token]); 
    const cancelCoords = this.#cancelPreviousCoords = coordsCts.cancel;
  
    try {
      await Promise.all([
        App.drawCircleAsync(x, y, r, token)
          .catch(au.cancelProof) // swallow cancellation error
          .finally(cancelCoords), // hide coords when finished

        App.drawTextAsync(x, y, r*2, coordsCts.token)
          .catch(au.cancelProof) // swallow cancellation error
      ]);
    }
    finally {
      coordsCts.close();
    }
  }
  
  //#endregion
  
  static async* streamMouseMoveEvents(token) {
    for await (const event of au.allEvents(document.body, "mousemove", token)) {
      token.throwIfCancellationRequested();
      yield { x: event.clientX, y: event.clientY };
    }
  } 
  
  async trackMouseAsync(token) {
    const radius = 30;
    await this.#mouseTrackingSemaphore.wait(token); 
    try {
      for await (const {x, y} of App.streamMouseMoveEvents(token)) {
        // don't await, we need concurrent drawings
        this.drawMouseTrackAsync(x, y, radius, token)
          .catch(console.error);
      } 
    }
    finally {
      this.#mouseTrackingSemaphore.release();
    }
  }
  
  static updateStartStopButton(button, state) {
    if (state === "start") {
      button.textContent = "Start";   
      button.classList.remove("stop");
      button.classList.add("start"); 
    }
    else if (state === "stop") {
      button.textContent = "Stop";
      button.classList.remove("start");
      button.classList.add("stop");   
    }
  }
  
  async run(token) {
    // the app's main logic as a pseudo-linear async workflow,
    // where we handle UI as stream of events, inspired by BLOC pattern

    // wait for the document to be ready
    if (document.readyState !== "complete") {
      await au.once(document, "DOMContentLoaded", token);
    }

    const startStopButton = document.querySelector("button#startButton");
    startStopButton.removeAttribute("disabled");  
    App.updateStartStopButton(startStopButton, "start");

    let isTrackingActive = false;
    let trackingCts = null;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // wait for stop/start commands
      await au.once(startStopButton, "click", token);

      // start or stop mouse tracking
      if (!isTrackingActive) {
        // start
        isTrackingActive = true;
        trackingCts = au.createCancellationTokenSource([token]);
        App.updateStartStopButton(startStopButton, "stop");
        this.trackMouseAsync(trackingCts.token).catch(console.warn);
      }
      else {
        // stop
        isTrackingActive = false;
        trackingCts?.cancel();
        trackingCts?.close();
        App.updateStartStopButton(startStopButton, "start");
      }
    }   
  }
}
