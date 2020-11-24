import * as au from './asyncUtils.js';

export default class App {
  #mouseTrackingSemaphore = new au.Semaphore(1);

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
    await App.drawCircleAsync(x, y, r, token).catch(au.cancelProof)
  }
  
  //#endregion
  
  static async* streamMouseMoveEvents(token) {
    for await (const {clientX, clientY} of au.allEvents(document.body, "mousemove", token)) {
      token.throwIfCancellationRequested();
      yield { x: clientX, y: clientY };
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
  
  async run() {
    // the app's main logic as a pseudo-linear async workflow,
    // where we handle UI as stream of events, inspired by BLOC pattern

    // wait for the document to be ready
    if (document.readyState !== "complete") {
      await au.once(document, "DOMContentLoaded");
    }

    const startStopButton = document.querySelector("button#startButton");
    startStopButton.removeAttribute("disabled");  
    App.updateStartStopButton(startStopButton, "start");

    let isTrackingActive = false;
    let trackingCts = null;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // wait for stop/start commands
      await au.once(startStopButton, "click");

      // start or stop mouse tracking
      if (!isTrackingActive) {
        // start
        isTrackingActive = true;
        trackingCts = au.createCancellationTokenSource();
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
