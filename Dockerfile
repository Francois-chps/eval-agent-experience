FROM node:22-bookworm

# System tools the agent may need inside synthetic repos (JS + Python)
RUN apt-get update && apt-get install -y --no-install-recommends \
      git python3 python3-pip python3-venv curl ca-certificates jq \
 && rm -rf /var/lib/apt/lists/*

ARG OPENCODE_VERSION=1.19.3
RUN npm install -g opencode-ai@${OPENCODE_VERSION}

# Run as non-root user (UID 1000 = same as default WSL user → no permission issues)
USER node
RUN git config --global user.email "agent@sandbox.local" \
 && git config --global user.name "agent" \
 && git config --global init.defaultBranch main

COPY --chown=node:node docker/opencode.json /home/node/.config/opencode/opencode.json
WORKDIR /app
