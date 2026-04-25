import { registerAs } from '@nestjs/config';
import * as path from 'path';

export default registerAs('storage', () => ({
  disk: {
    basePath: path.join(process.cwd(), 'storage'),
    raw: path.join(process.cwd(), 'storage/raw'),
    hls: path.join(process.cwd(), 'storage/hls'),
    thumbnails: path.join(process.cwd(), 'storage/thumbnails'),
  },
}));
