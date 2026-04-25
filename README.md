# Vi-Process Backend

The backend engine for Vi-Process, a feature-rich video streaming platform. This service handles video uploads, automated transcoding into HLS format, user authentication, real-time watch parties, and YouTube imports.

## 🚀 Features

- **Video Processing Pipeline**: Automated transcoding of raw videos into multiple HLS renditions (240p, 360p, 480p, 720p) using FFmpeg and BullMQ.
- **Real-time Watch Parties**: Synchronized video playback for multiple users via WebSockets (Socket.io).
- **YouTube Import**: Integration with `yt-dlp` to import videos directly from YouTube.
- **User Management**: Secure authentication using JWT and bcrypt.
- **Thumbnail Generation**: Automatic extraction of main thumbnails and preview sprites.
- **Scalable Architecture**: Built with NestJS, using Redis for task queuing and real-time state management.

## 🛠️ Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) (Node.js)
- **Database**: SQLite (TypeORM)
- **Task Queue**: BullMQ + Redis
- **Real-time**: Socket.io + Redis Adapter
- **Video Engine**: FFmpeg + `yt-dlp`
- **Language**: TypeScript

## 📋 Prerequisites

- Node.js (v20+)
- Redis
- FFmpeg (installed and available in PATH)
- Python (for `yt-dlp`)

## ⚙️ Project Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Configuration**:
   Create a `.env` file in the root (refer to `src/config/` for available options):
   ```env
   PORT=3000
   REDIS_HOST=localhost
   REDIS_PORT=6379
   JWT_SECRET=your_secret_key
   ```

3. **Database**:
   The project uses SQLite by default, which will automatically create `database.sqlite` on first run.

## 🏃 Running the Project

```bash
# development
$ npm run start:dev

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## 🧪 Testing

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e
```

## 📂 Project Structure

- `src/modules/video`: Video management, uploads, and metadata.
- `src/modules/queue`: BullMQ processors for video transcoding.
- `src/modules/watch-party`: WebSocket gateways for synchronized playback.
- `src/modules/auth`: JWT-based authentication logic.
- `src/workers/ffmpeg`: Core logic for video manipulation.
- `storage/`: Directory for raw videos, HLS segments, and thumbnails.
