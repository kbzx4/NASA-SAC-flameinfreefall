/* Links used by the buttons on both pages. Leave demo empty until the video is online;
   the Demo button stays disabled while it is empty. */
window.FF_LINKS = {
  repo: "https://github.com/kbzx4/NASA-SAC-flameinfreefall",
  demo: "demo.mp4",
  challenge: "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/",
  psi: "https://psi.nasa.gov/physci/repo/search?q=combustion",
};

/* Live SI (assets/ai.js). Set ONE of these to turn it on for every visitor:
     proxy: the URL of proxy/gemini-proxy.gs deployed as a web app (keeps the key secret), or
     key:   a Gemini API key. Anyone can read a key placed here and use its quota.
   With both empty, visitors can paste their own key, which stays in their browser. */
window.FF_AI = {
  proxy: "https://script.google.com/macros/s/AKfycbx5BTA-i6M0SzTLDrynFsU8H5DvmYfRm-Jieud9DC8TGwQZdRkE-x57Ah1eHdVniHSB/exec",
  key: "",
};
