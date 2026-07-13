FROM debian:bookworm-slim

ARG TZ=Asia/Tokyo
ENV TZ="$TZ"

RUN apt-get update && apt-get install -y --no-install-recommends \
  curl \
  xvfb \
  fluxbox \
  x11vnc \
  novnc \
  websockify \
  chromium \
  chromium-sandbox \
  fonts-noto-cjk \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Node.js 20 のインストール
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN ln -s /usr/share/novnc/vnc.html /usr/share/novnc/index.html

# chrome-devtools-mcp が探すパスにシンボリックリンク
RUN ln -s /usr/bin/chromium /usr/bin/google-chrome && \
    mkdir -p /opt/google/chrome && \
    ln -s /usr/bin/chromium /opt/google/chrome/chrome

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 6080 3100

CMD ["/entrypoint.sh"]
