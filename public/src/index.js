import App from './app.js';

// handle unhandled promise rejections
window.addEventListener("unhandledrejection", event => {
  console.warn(`unhandledRejection: ${event.reason.message}`);
});

// Run App.run 
async function main() {
  try {
    await new App().run();
  }
  catch(error) {
    console.error(error);
    alert(error.message);
  }
} 

main().catch(console.error);