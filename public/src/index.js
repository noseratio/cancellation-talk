import * as au from './asyncUtils.js';
import App from './app.js';

// handle unhandled promise rejections
window.addEventListener("unhandledrejection", event => {
  console.warn(`unhandledRejection: ${event.reason.message}`);
});

// Run App.run with cancellation
async function main() {
  const cts = au.createCancellationTokenSource();
  setTimeout(() => cts.cancel(), 10_000);

  try {
    await new App().run(cts.token);
  }
  catch(error) {
    if (error instanceof au.CancelError) {
      console.warn(error.message);
      document.body.textContent = "The show is over!";
    }
    else {
      console.error(error);
      alert(error.message);
    }
  }
} 

main().catch(console.error);