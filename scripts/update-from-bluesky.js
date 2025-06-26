import { BskyAgent } from '@atproto/api';
import fs from 'fs';

const agent = new BskyAgent({
  service: 'https://bsky.social'
});

try {
  await agent.login({
    identifier: process.env.BLUESKY_HANDLE,
    password: process.env.BLUESKY_APP_PASSWORD
  });

  console.log('Successfully logged in to Bluesky');
  
  // We'll add the content fetching logic here next
  
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
