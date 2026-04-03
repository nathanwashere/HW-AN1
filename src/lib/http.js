const fs = require("fs");
const querystring = require("querystring");

function parseCookies(header) {
  const cookies = {};
  if (!header) {
    return cookies;
  }

  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    cookies[name] = decodeURIComponent(rest.join("=") || "");
  }

  return cookies;
}

function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => resolve(querystring.parse(body)));
    req.on("error", reject);
  });
}

function redirect(res, location, cookies = []) {
  res.writeHead(302, {
    Location: location,
    "Set-Cookie": cookies
  });
  res.end();
}

function sendHtml(res, status, html, cookies = []) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Set-Cookie": cookies
  });
  res.end(html);
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function sendAsset(res, filePath, contentType) {
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch {
    sendText(res, 404, "Not found");
  }
}

module.exports = {
  parseCookies,
  getRequestBody,
  redirect,
  sendHtml,
  sendText,
  sendAsset
};
