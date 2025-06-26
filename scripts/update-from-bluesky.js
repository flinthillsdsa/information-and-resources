import { BskyAgent } from '@atproto/api';
import fs from 'fs';
import path from 'path';

const agent = new BskyAgent({
  service: 'https://bsky.social'
});

// Helper function to format date
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Helper function to clean hashtags from text
function cleanText(text) {
  return text
    .replace(/#news\b/gi, '')
    .replace(/#announcement\b/gi, '')
    .replace(/#announce\b/gi, '')
    .trim();
}

// Helper function to get Bluesky post URL
function getBlueSkyUrl(uri, handle) {
  const postId = uri.split('/').pop();
  return `https://bsky.app/profile/${handle}/post/${postId}`;
}

// Helper function to generate Jekyll front matter and content
function generateJekyllContent(posts, type, originalContent) {
  // Extract the existing front matter
  const frontMatterMatch = originalContent.match(/^---\n([\s\S]*?)\n---/);
  const frontMatter = frontMatterMatch ? frontMatterMatch[1] : '';
  
  // Generate new content
  const content = posts.map(post => {
    const cleanedText = cleanText(post.text);
    const postUrl = getBlueSkyUrl(post.uri, process.env.BLUESKY_HANDLE);
    
    return `### ${formatDate(post.createdAt)}

${cleanedText}

[View on Bluesky](${postUrl})

---`;
  }).join('\n\n');

  // Combine front matter with new content
  return `---
${frontMatter}
---

${content}`;
}

async function fetchAndUpdateContent() {
  try {
    // Login to Bluesky
    console.log('Logging into Bluesky...');
    await agent.login({
      identifier: process.env.BLUESKY_HANDLE,
      password: process.env.BLUESKY_APP_PASSWORD
    });
    console.log('✅ Successfully logged in to Bluesky');

    // Get recent posts from your feed
    console.log('Fetching recent posts...');
    const posts = await agent.getAuthorFeed({
      actor: process.env.BLUESKY_HANDLE,
      limit: 50
    });

    const newsPosts = [];
    const announcementPosts = [];

    // Filter posts by hashtags
    posts.data.feed.forEach(item => {
      const text = item.post.record.text;
      const postData = {
        text: text,
        createdAt: item.post.record.createdAt,
        uri: item.post.uri,
        embed: item.post.record.embed
      };

      if (text.includes('#news')) {
        newsPosts.push(postData);
      }
      
      if (text.includes('#announcement') || text.includes('#announce')) {
        announcementPosts.push(postData);
      }
    });

    // Sort by date (newest first) and take only the last 3
    const sortedNews = newsPosts
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);
    
    const sortedAnnouncements = announcementPosts
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);

    console.log(`Found ${sortedNews.length} news posts and ${sortedAnnouncements.length} announcement posts`);

    // Read existing files to preserve front matter
    const newsFilePath = '_portfolio/3-news.md';
    const announcementsFilePath = '_portfolio/2-anouncements.md';

    let existingNewsContent = '';
    let existingAnnouncementsContent = '';

    try {
      existingNewsContent = fs.readFileSync(newsFilePath, 'utf8');
    } catch (error) {
      console.log('News file not found, will create new one');
      existingNewsContent = `---
layout: post
title: News
feature-img: "assets/img/portfolio/tractor.png"
img: "assets/img/portfolio/tractor.png"
date: ${new Date().toISOString().split('T')[0]}
---`;
    }

    try {
      existingAnnouncementsContent = fs.readFileSync(announcementsFilePath, 'utf8');
    } catch (error) {
      console.log('Announcements file not found, will create new one');
      existingAnnouncementsContent = `---
layout: post
title: Announcements
feature-img: "assets/img/portfolio/tractor.png"
img: "assets/img/portfolio/tractor.png"
date: ${new Date().toISOString().split('T')[0]}
---`;
    }

    // Update news file
    if (sortedNews.length > 0) {
      const newNewsContent = generateJekyllContent(sortedNews, 'news', existingNewsContent);
      fs.writeFileSync(newsFilePath, newNewsContent);
      console.log('✅ Updated news file');
    } else {
      console.log('No news posts found, keeping existing content');
    }

    // Update announcements file
    if (sortedAnnouncements.length > 0) {
      const newAnnouncementsContent = generateJekyllContent(sortedAnnouncements, 'announcements', existingAnnouncementsContent);
      fs.writeFileSync(announcementsFilePath, newAnnouncementsContent);
      console.log('✅ Updated announcements file');
    } else {
      console.log('No announcement posts found, keeping existing content');
    }

    console.log('🎉 Content update completed successfully!');

  } catch (error) {
    console.error('❌ Error updating content:', error);
    process.exit(1);
  }
}

// Validate environment variables
if (!process.env.BLUESKY_HANDLE || !process.env.BLUESKY_APP_PASSWORD) {
  console.error('❌ Missing required environment variables: BLUESKY_HANDLE and BLUESKY_APP_PASSWORD');
  process.exit(1);
}

// Run the update
fetchAndUpdateContent();
