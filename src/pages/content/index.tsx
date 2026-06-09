import ContentPage from "@src/core/content/contentPage";
import { createRoot } from "react-dom/client";

try {
  const divElem = document.createElement("div");
  divElem.id = "__root";
  document.documentElement.prepend(divElem);

  const shadowRoot = divElem.attachShadow({ mode: "open" });
  const shadowContainer = document.createElement("div");
  shadowContainer.id = "__shadow-root";

  shadowRoot.appendChild(shadowContainer);

  const rootContainer = shadowRoot.querySelector("#__shadow-root");
  if (!rootContainer) throw new Error("Can't find Content root element");

  const root = createRoot(rootContainer);
  root.render(<ContentPage />);

} catch (e) {
  console.error("خطا در کانتنت اسکریپت:", e);
}