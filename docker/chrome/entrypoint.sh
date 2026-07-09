#!/bin/bash

rm -f /tmp/.X0-lock /tmp/.X1-lock
rm -f /tmp/.X11-unix/X0 /tmp/.X11-unix/X1

# 1. 仮想ディスプレイの起動
Xvfb :0 -screen 0 1920x1080x16 &
sleep 2
fluxbox &

# 2. VNCサーバーを起動（パスワードなし）
x11vnc -display :0 -forever -nopw -rfbport 5900 &

# 3. ブラウザから見れるようにする(noVNC)
websockify --web /usr/share/novnc/ 6080 localhost:5900 &

# 4. 仮想画面にChromiumを起動（ローカルでデバッグポートを開く）
export DISPLAY=:0
chromium \
  --no-sandbox \
  --disable-setuid-sandbox \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-data \
  about:blank &

sleep 3

# 5. chrome-devtools-mcp を Streamable HTTP サーバーとして起動
exec npx -y supergateway \
  --port 3100 \
  --outputTransport streamableHttp \
  --stateful \
  --stdio "npx -y chrome-devtools-mcp@latest --browserUrl http://localhost:9222"
