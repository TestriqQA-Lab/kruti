/**
 * GET /api/mobile/subscription/checkout-page
 *
 * Serves a Razorpay-hosted-style HTML page that loads the standard
 * Razorpay JS Checkout (the SAME SDK web uses, not the buggy native
 * react-native-razorpay one). The mobile app opens this page in an
 * in-app browser. After the user pays, the page redirects to a
 * krutimobile:// deep link with the payment IDs, the in-app browser
 * detects the scheme + closes, and the app verifies the payment.
 *
 * This entire approach exists because react-native-razorpay v3.0.0
 * does not work reliably with India's RBI eMandate / 3DS-on-cards
 * for subscriptions. The web checkout handles all of that correctly.
 *
 * Query params (built by the mobile app from /create-order response):
 *   sub   = razorpay subscription id (sub_xxx)
 *   key   = razorpay key id (rzp_test_xxx / rzp_live_xxx)
 *   name  = user name (prefill, optional)
 *   email = user email (prefill, optional)
 *
 * Place at: app/api/mobile/subscription/checkout-page/route.ts
 */

import { NextRequest } from "next/server";

// Escape any string we drop into JS so a malicious value can't break out
// of the JSON.stringify literal. JSON.stringify is sufficient on the
// string side; this is just an extra belt-and-suspenders for any HTML
// rendering paths.
function safe(s: string): string {
  return s.replace(/[<>&]/g, (c) => `\\u00${c.charCodeAt(0).toString(16)}`);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sub = url.searchParams.get("sub") || "";
  const key = url.searchParams.get("key") || "";
  const name = url.searchParams.get("name") || "";
  const email = url.searchParams.get("email") || "";

  if (!sub || !key) {
    return new Response("Missing required params (sub, key)", { status: 400 });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="theme-color" content="#5B52C9" />
  <title>Kruti — Secure Payment</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #EEF1FE 0%, #F8FAFC 100%);
      min-height: 100vh;
      color: #221F3D;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .container { text-align: center; max-width: 360px; width: 100%; }
    .logo {
      width: 78px;
      height: 78px;
      border-radius: 18px;
      background: #5B52C9;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 22px;
      color: #FFFFFF;
      font-size: 38px;
      font-weight: 800;
      letter-spacing: -2.5px;
      box-shadow: 0 14px 30px rgba(91, 82, 201, 0.34);
    }
    h1 {
      font-size: 21px;
      font-weight: 800;
      margin-bottom: 8px;
      letter-spacing: -0.4px;
    }
    p { font-size: 13.5px; color: #807D99; line-height: 1.55; }
    .spinner {
      width: 26px;
      height: 26px;
      border: 3px solid #DEDCFB;
      border-top-color: #5B52C9;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
      margin: 22px auto 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .btn {
      margin-top: 18px;
      background: #5B52C9;
      color: #FFFFFF;
      padding: 13px 28px;
      border-radius: 12px;
      border: none;
      font-size: 14.5px;
      font-weight: 700;
      cursor: pointer;
      display: none;
      box-shadow: 0 8px 20px rgba(91, 82, 201, 0.3);
    }
    .btn:active { transform: scale(0.97); }
    .btn-secondary {
      background: transparent;
      color: #807D99;
      font-size: 13px;
      font-weight: 600;
      box-shadow: none;
      margin-top: 6px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">K</div>
    <h1 id="title">Opening secure checkout…</h1>
    <p id="sub">Razorpay payment is loading. This is the same secure flow used on kruti.io.</p>
    <div class="spinner" id="spinner"></div>
    <button id="retry" class="btn" onclick="openCheckout()">Open Payment Again</button>
    <button id="back" class="btn btn-secondary" onclick="cancelToApp()">Cancel & go back</button>
  </div>
  <script>
    var SUB_ID = ${JSON.stringify(sub)};
    var KEY    = ${JSON.stringify(key)};
    var UNAME  = ${JSON.stringify(name)};
    var UEMAIL = ${JSON.stringify(email)};
    var APP_SCHEME = "krutimobile://payment-callback";

    function setStatus(title, subtitle, showRetry) {
      document.getElementById("title").textContent = title;
      document.getElementById("sub").textContent   = subtitle;
      document.getElementById("spinner").style.display = showRetry ? "none" : "block";
      document.getElementById("retry").style.display   = showRetry ? "inline-block" : "none";
      document.getElementById("back").style.display    = showRetry ? "inline-block" : "none";
    }

    function returnToApp(params) {
      var qs = Object.keys(params).map(function (k) {
        return encodeURIComponent(k) + "=" + encodeURIComponent(params[k] == null ? "" : params[k]);
      }).join("&");
      window.location.href = APP_SCHEME + "?" + qs;
    }

    function cancelToApp() { returnToApp({ status: "cancelled" }); }

    function openCheckout() {
      setStatus("Opening secure checkout…", "Razorpay is loading. Please wait.", false);

      var opts = {
        key: KEY,
        subscription_id: SUB_ID,
        name: "Kruti",
        description: "Content Pro — Monthly",
        prefill: { name: UNAME, email: UEMAIL },
        theme: { color: "#5B52C9" },
        modal: {
          ondismiss: function () {
            setStatus(
              "Payment cancelled",
              "You closed the payment sheet. Tap below to try again, or cancel to go back.",
              true
            );
          }
        },
        handler: function (response) {
          // On Razorpay success — return to the app via deep link.
          returnToApp({
            status: "success",
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_subscription_id: response.razorpay_subscription_id || SUB_ID,
            razorpay_signature: response.razorpay_signature
          });
        }
      };

      var rzp = new Razorpay(opts);
      rzp.on("payment.failed", function (resp) {
        var msg = (resp && resp.error && resp.error.description) || "Payment failed";
        setStatus(
          "Payment failed",
          msg + ". Tap below to try again.",
          true
        );
      });
      rzp.open();
    }

    // Auto-open the checkout shortly after the page loads.
    window.addEventListener("load", function () {
      setTimeout(openCheckout, 400);
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      // Prevent embedding — only opened directly from the mobile browser.
      "X-Frame-Options": "DENY",
    },
  });
}