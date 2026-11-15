/**
 * Airburn live-SI proxy, as a Google Apps Script web app.
 *
 * It keeps the Gemini API key off the public site: the page sends {model, body} here, and this
 * script adds the key and forwards the request to Gemini. It only allows the models below, caps
 * the request size, and stops after DAILY_LIMIT requests a day so the free quota is not drained.
 *
 * Set up (about five minutes, with the Google account that owns the key):
 *   1. Open https://script.google.com and create a new project. Paste this file in as Code.gs.
 *   2. Project Settings > Script properties > Add property:  GEMINI_API_KEY = your key.
 *   3. Deploy > New deployment > type "Web app". Execute as: Me. Who has access: Anyone. Deploy.
 *   4. Copy the web app URL (it ends in /exec) into docs/assets/config.js as FF_AI.proxy.
 * After editing this file, use Deploy > Manage deployments > Edit > New version, or the change
 * does not reach the live URL.
 */
const MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemma-4-26b-a4b-it"];
const DAILY_LIMIT = 400;
const MAX_CHARS = 60000;
const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent";

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ error: { code: 400, message: "Request is not JSON." } });
  }
  if (MODELS.indexOf(req.model) < 0) return reply({ error: { code: 400, message: "Model not allowed." } });
  const body = req.body || {};
  body.generationConfig = Object.assign({}, body.generationConfig, {
    maxOutputTokens: Math.min(8192, (body.generationConfig || {}).maxOutputTokens || 8192),
  });
  const payload = JSON.stringify({ contents: body.contents, generationConfig: body.generationConfig });
  if (payload.length > MAX_CHARS) return reply({ error: { code: 400, message: "Request too long." } });

  const cache = CacheService.getScriptCache();
  const day = "count-" + new Date().toISOString().slice(0, 10);
  const used = Number(cache.get(day) || 0);
  if (used >= DAILY_LIMIT) return reply({ error: { code: 429, message: "Daily limit reached." } });
  cache.put(day, String(used + 1), 21600);

  const key = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  const res = UrlFetchApp.fetch(GEMINI.replace("%s", req.model), {
    method: "post",
    contentType: "application/json",
    headers: { "x-goog-api-key": key },
    payload: payload,
    muteHttpExceptions: true,
  });
  return ContentService.createTextOutput(res.getContentText()).setMimeType(ContentService.MimeType.JSON);
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
