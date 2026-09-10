import { startLoadingUI, showLoadingError } from "./geo/loading-ui";
startLoadingUI();
void import("./geo/main").catch((error) => {
  console.error("Unable to load the journey", error);
  showLoadingError("The journey could not load. Please reload to try again.");
});
