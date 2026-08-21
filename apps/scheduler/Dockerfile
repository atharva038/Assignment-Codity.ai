FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/scheduler ./apps/scheduler
RUN npm install
RUN npm run build --workspace=@job-scheduler/scheduler

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/scheduler ./apps/scheduler

CMD ["npm", "run", "start", "--workspace=@job-scheduler/scheduler"]
