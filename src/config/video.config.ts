import { registerAs } from '@nestjs/config';

export default registerAs('video', () => ({
  resolutions: [
    { name: '240p', height: 240, width: 426, bitrate: '400k' },
    { name: '360p', height: 360, width: 640, bitrate: '800k' },
    { name: '480p', height: 480, width: 854, bitrate: '1400k' },
    { name: '720p', height: 720, width: 1280, bitrate: '2800k' },
  ],
  thumbnailInterval: 10, // seconds
  thumbnailGrid: {
    cols: 5,
    rows: 5,
    width: 160,
    height: 90,
  },
}));
