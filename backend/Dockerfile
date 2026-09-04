# Noira Forge entity — self-healing container
FROM node:22-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
COPY dist-web ./dist-web
RUN npm run build
RUN npm prune --omit=dev
# persistent memory lives here — mount a volume!
VOLUME ["/app/data"]
ENV PORT=3001 NODE_ENV=production
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://localhost:3001/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
